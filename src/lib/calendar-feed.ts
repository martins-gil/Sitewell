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

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Scheduled",
  RESCHEDULED: "Rescheduled",
  COMPLETED: "Completed",
};

function kitLine(kit: { name: string; expiryDate: Date | null }): string {
  return `- ${kit.name}${kit.expiryDate ? ` (expires ${humanDate(kit.expiryDate)})` : ""}`;
}

function eventLines(visit: FeedVisit, origin: string): string[] {
  const link = `${origin}/dashboard/visits/${visit.id}`;
  const done = visit.status === "COMPLETED";
  const linked = visit.kits;
  // Only worth mentioning for a visit still to come.
  const earmarked = linked.length === 0 && !done ? (visit.template?.kits ?? []) : [];

  const description = [
    `Study: ${visit.study.protocolId} — ${visit.study.title}`,
    `Patient: ${visit.subject.subjectCode}`,
    `Visit: ${visit.visitType}`,
    `Window: ${humanDate(visit.windowStart)} – ${humanDate(visit.windowEnd)}`,
    `Status: ${STATUS_LABEL[visit.status] ?? visit.status}`,
    ...(linked.length > 0 ? ["", "Kits for this visit:", ...linked.map(kitLine)] : []),
    ...(earmarked.length > 0
      ? ["", "Kits set aside for this visit type (not assigned to this visit yet):", ...earmarked.map(kitLine)]
      : []),
    "",
    `Open this visit in SiteWell-ct: ${link}`,
  ].join("\n");

  const day = visit.targetDate;
  const nextDay = new Date(day.getTime() + DAY_MS);

  return [
    "BEGIN:VEVENT",
    `UID:visit-${visit.id}@sitewell-ct`,
    `DTSTAMP:${stamp(visit.updatedAt)}`,
    `LAST-MODIFIED:${stamp(visit.updatedAt)}`,
    `DTSTART;VALUE=DATE:${dateValue(day)}`,
    `DTEND;VALUE=DATE:${dateValue(nextDay)}`,
    `SUMMARY:${escapeText(`${done ? "✓ " : ""}${visit.visitType} — ${visit.subject.subjectCode} (${visit.study.protocolId})`)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `URL:${link}`,
    "STATUS:CONFIRMED",
    // An all-day visit shouldn't make the user look "busy" all day.
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
  ];
}

/** The whole calendar file. `origin` is the app's address, for each visit's link. */
export function buildIcs(visits: FeedVisit[], origin: string): string {
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
    ...visits.flatMap((visit) => eventLines(visit, origin)),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
