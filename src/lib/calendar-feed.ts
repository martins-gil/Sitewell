import { createHmac, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";

// Sharing the visit calendar with Apple Calendar, Google Calendar and Outlook.
//
// Two ways out: a private *subscription* link (an .ics URL those apps poll, so
// the calendar stays up to date by itself) and a one-time .ics download. Both
// are built here from the same visits.
//
// The subscription URL has to work with no login — Google's or Microsoft's
// servers fetch it, not the user's browser — so it carries its own credential:
// a token signed with AUTH_SECRET (`org.user.version.signature`). Nothing secret
// is stored: the user's `calendarFeedVersion` is the only state, so a new link
// (version + 1) kills the old one and switching the feed off kills them all.

const SEP = ".";

function secret(): string | null {
  return process.env.AUTH_SECRET || null;
}

function sign(payload: string): string | null {
  const key = secret();
  if (!key) return null;
  return createHmac("sha256", key).update(`calendar-feed:${payload}`).digest("base64url");
}

export function makeFeedToken(organizationId: string, userId: string, version: number): string | null {
  const payload = [organizationId, userId, String(version)].join(SEP);
  const signature = sign(payload);
  return signature ? `${payload}${SEP}${signature}` : null;
}

export type FeedTokenParts = { organizationId: string; userId: string; version: number };

/** The parts of a feed token, only if its signature is genuine. */
export function readFeedToken(token: string): FeedTokenParts | null {
  const parts = token.split(SEP);
  if (parts.length !== 4) return null;
  const [organizationId, userId, versionText, signature] = parts;
  const version = Number(versionText);
  if (!organizationId || !userId || !Number.isInteger(version) || version < 1) return null;

  const expected = sign([organizationId, userId, versionText].join(SEP));
  if (!expected) return null;
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { organizationId, userId, version };
}

// ---- The visits ----

const DAY_MS = 24 * 60 * 60 * 1000;
// A subscribed calendar shows what's coming up plus the recent past: a visit
// long done isn't something to keep pushing to phones.
const HISTORY_DAYS = 60;

export async function loadFeedVisits(tx: Prisma.TransactionClient, options: { studyId?: string } = {}) {
  return tx.visit.findMany({
    where: {
      ...(options.studyId ? { studyId: options.studyId } : {}),
      status: { in: ["SCHEDULED", "RESCHEDULED", "COMPLETED"] },
      targetDate: { gte: new Date(Date.now() - HISTORY_DAYS * DAY_MS) },
    },
    orderBy: { targetDate: "asc" },
    select: {
      id: true,
      visitType: true,
      targetDate: true,
      startTime: true,
      windowStart: true,
      windowEnd: true,
      status: true,
      updatedAt: true,
      subject: { select: { subjectCode: true } },
      study: { select: { protocolId: true, title: true } },
      // Kits tied to this visit; the ones set aside for its visit type are the
      // fallback when none has been linked yet.
      kits: { where: { usedAt: null }, select: { name: true, expiryDate: true }, orderBy: { name: "asc" } },
      template: {
        select: {
          kits: {
            where: { visitId: null, usedAt: null },
            select: { name: true, expiryDate: true },
            orderBy: { name: "asc" },
          },
        },
      },
    },
  });
}

export type FeedVisit = Awaited<ReturnType<typeof loadFeedVisits>>[number];

/** Monitoring visits for the same window, with their points to verify. */
export async function loadFeedMonitoring(tx: Prisma.TransactionClient, options: { studyId?: string } = {}) {
  return tx.monitoringVisit.findMany({
    where: {
      ...(options.studyId ? { studyId: options.studyId } : {}),
      visitDate: { gte: new Date(Date.now() - HISTORY_DAYS * DAY_MS) },
    },
    orderBy: { visitDate: "asc" },
    select: {
      id: true,
      visitDate: true,
      startTime: true,
      room: true,
      notes: true,
      updatedAt: true,
      study: { select: { protocolId: true, title: true } },
      items: { select: { label: true, verified: true }, orderBy: { sortOrder: "asc" } },
    },
  });
}

export type FeedMonitoring = Awaited<ReturnType<typeof loadFeedMonitoring>>[number];

/** Everything a calendar file is built from. */
export async function loadFeedData(tx: Prisma.TransactionClient, options: { studyId?: string } = {}) {
  const [visits, monitoring] = await Promise.all([loadFeedVisits(tx, options), loadFeedMonitoring(tx, options)]);
  return { visits, monitoring };
}

export type FeedData = Awaited<ReturnType<typeof loadFeedData>>;

// ---- iCalendar text (RFC 5545) ----

const pad = (n: number) => String(n).padStart(2, "0");

/** Visit dates are stored at noon UTC, so the UTC calendar day is the visit's day. */
function dateValue(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

function stamp(date: Date): string {
  return `${dateValue(date)}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function humanDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines over 75 bytes are folded onto continuation lines that start with a space. */
function fold(line: string): string {
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char);
    if (bytes + size > 74) {
      out.push(current);
      current = " ";
      bytes = 1;
    }
    current += char;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n");
}

// Visits have a start time but no end time, so a timed event gets a fixed length:
// an hour for a patient visit, two for a monitoring visit.
const VISIT_MINUTES = 60;
const MONITORING_MINUTES = 120;

/**
 * DTSTART/DTEND lines for a day and an optional "HH:mm". With a time the event is
 * "floating" (no time zone): it lands at 09:30 on the calendar owner's own clock,
 * which is what a site's staff, all in one place, want. Without one it's all-day.
 */
function whenLines(day: Date, time: string | null, minutes: number): string[] {
  if (!time) {
    return [`DTSTART;VALUE=DATE:${dateValue(day)}`, `DTEND;VALUE=DATE:${dateValue(new Date(day.getTime() + DAY_MS))}`];
  }
  const [hours, mins] = time.split(":").map(Number);
  const startMs = day.getTime() - (day.getUTCHours() * 60 + day.getUTCMinutes()) * 60_000 + (hours * 60 + mins) * 60_000;
  const end = new Date(startMs + minutes * 60_000);
  const local = (d: Date) => `${dateValue(d)}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00`;
  return [`DTSTART:${local(new Date(startMs))}`, `DTEND:${local(end)}`];
}

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Scheduled",
  RESCHEDULED: "Rescheduled",
  COMPLETED: "Completed",
};

function kitLine(kit: { name: string; expiryDate: Date | null }): string {
  return `- ${kit.name}${kit.expiryDate ? ` (expires ${humanDate(kit.expiryDate)})` : ""}`;
}

function visitEventLines(visit: FeedVisit, origin: string): string[] {
  const link = `${origin}/dashboard/visits/${visit.id}`;
  const done = visit.status === "COMPLETED";
  const linked = visit.kits;
  // Only worth mentioning for a visit still to come.
  const earmarked = linked.length === 0 && !done ? (visit.template?.kits ?? []) : [];

  const description = [
    `Study: ${visit.study.protocolId} — ${visit.study.title}`,
    `Patient: ${visit.subject.subjectCode}`,
    `Visit: ${visit.visitType}`,
    ...(visit.startTime ? [`Time: ${visit.startTime}`] : []),
    `Window: ${humanDate(visit.windowStart)} – ${humanDate(visit.windowEnd)}`,
    `Status: ${STATUS_LABEL[visit.status] ?? visit.status}`,
    ...(linked.length > 0 ? ["", "Kits for this visit:", ...linked.map(kitLine)] : []),
    ...(earmarked.length > 0
      ? ["", "Kits set aside for this visit type (not assigned to this visit yet):", ...earmarked.map(kitLine)]
      : []),
    "",
    `Open this visit in SiteWell-ct: ${link}`,
  ].join("\n");

  return [
    "BEGIN:VEVENT",
    `UID:visit-${visit.id}@sitewell-ct`,
    `DTSTAMP:${stamp(visit.updatedAt)}`,
    `LAST-MODIFIED:${stamp(visit.updatedAt)}`,
    ...whenLines(visit.targetDate, visit.startTime, VISIT_MINUTES),
    `SUMMARY:${escapeText(`${done ? "✓ " : ""}${visit.visitType} — ${visit.subject.subjectCode} (${visit.study.protocolId})`)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `URL:${link}`,
    "STATUS:CONFIRMED",
    // An all-day visit shouldn't make the user look "busy" all day.
    ...(visit.startTime ? [] : ["TRANSP:TRANSPARENT"]),
    "END:VEVENT",
  ];
}

function monitoringEventLines(visit: FeedMonitoring, origin: string): string[] {
  const link = `${origin}/dashboard/monitoring/${visit.id}`;
  const description = [
    `Study: ${visit.study.protocolId} — ${visit.study.title}`,
    ...(visit.startTime ? [`Time: ${visit.startTime}`] : []),
    ...(visit.room ? [`Room: ${visit.room}`] : []),
    ...(visit.notes ? ["", visit.notes] : []),
    ...(visit.items.length > 0
      ? ["", "Points to verify:", ...visit.items.map((item) => `${item.verified ? "[x]" : "[ ]"} ${item.label}`)]
      : []),
    "",
    `Open this monitoring visit in SiteWell-ct: ${link}`,
  ].join("\n");

  return [
    "BEGIN:VEVENT",
    `UID:monitoring-${visit.id}@sitewell-ct`,
    `DTSTAMP:${stamp(visit.updatedAt)}`,
    `LAST-MODIFIED:${stamp(visit.updatedAt)}`,
    ...whenLines(visit.visitDate, visit.startTime, MONITORING_MINUTES),
    `SUMMARY:${escapeText(`Monitoring visit — ${visit.study.protocolId}`)}`,
    ...(visit.room ? [`LOCATION:${escapeText(visit.room)}`] : []),
    `DESCRIPTION:${escapeText(description)}`,
    `URL:${link}`,
    "STATUS:CONFIRMED",
    ...(visit.startTime ? [] : ["TRANSP:TRANSPARENT"]),
    "END:VEVENT",
  ];
}

/** The whole calendar file. `origin` is the app's address, for each visit's link. */
export function buildIcs(data: FeedData, origin: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SiteWell-ct//Visits//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:SiteWell-ct visits",
    // Hints for subscribing apps on how often to look again (they may use their own).
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...data.visits.flatMap((visit) => visitEventLines(visit, origin)),
    ...data.monitoring.flatMap((visit) => monitoringEventLines(visit, origin)),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}