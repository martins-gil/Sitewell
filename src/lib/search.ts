import { requireTenantContext, withTenantContext } from "@/lib/db-context";
import { humanizeEnum } from "@/lib/format";

export type SearchHit = {
  id: string;
  href: string;
  title: string;
  detail: string;
  // Raw values the screen translates/formats itself.
  status?: string;
  kindLabel?: string;
  date?: string;
};

export type SearchResults = {
  patients: SearchHit[];
  visits: SearchHit[];
  studies: SearchHit[];
  documents: SearchHit[];
  kits: SearchHit[];
};

export const EMPTY_RESULTS: SearchResults = { patients: [], visits: [], studies: [], documents: [], kits: [] };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * "RCN-101-0009, week 4" -> ["rcn-101-0009", "week", "4"]. Commas, semicolons,
 * line breaks and spaces all just separate terms; an item matches when it
 * contains EVERY term (in any order, accents and case ignored), so the more you
 * type the fewer results you get.
 */
export function searchTerms(query: string): string[] {
  return query
    .split(/[\s,;]+/)
    .map((t) => norm(t.trim()))
    .filter((t) => t.length > 0)
    .slice(0, 8);
}

const matchesAll = (haystack: string, terms: string[]) => {
  const h = norm(haystack);
  return terms.every((t) => h.includes(t));
};

/** Patients, visits, studies, documents and kits matching every term of the query. */
export async function searchAll(query: string, limit: number): Promise<SearchResults> {
  const terms = searchTerms(query);
  if (terms.length === 0) return EMPTY_RESULTS;

  // The database narrows by the longest term; the rest is checked here, where
  // it's easy to do accent-insensitively across several fields at once.
  const anchor = [...terms].sort((a, b) => b.length - a.length)[0];
  const contains = { contains: anchor, mode: "insensitive" as const };
  const ctx = await requireTenantContext();

  return withTenantContext(ctx, async (tx) => {
    const [subjects, visits, studies, documents, kits] = await Promise.all([
      tx.subject.findMany({
        where: {
          OR: [{ subjectCode: contains }, { displayName: contains }, { study: { protocolId: contains } }],
        },
        select: {
          id: true,
          subjectCode: true,
          displayName: true,
          status: true,
          study: { select: { protocolId: true } },
        },
        orderBy: { subjectCode: "asc" },
        take: 300,
      }),
      tx.visit.findMany({
        where: {
          OR: [
            { visitType: contains },
            { subject: { subjectCode: contains } },
            { subject: { displayName: contains } },
            { study: { protocolId: contains } },
          ],
        },
        select: {
          id: true,
          visitType: true,
          status: true,
          targetDate: true,
          subject: { select: { subjectCode: true, displayName: true } },
          study: { select: { protocolId: true } },
        },
        orderBy: { targetDate: "asc" },
        take: 400,
      }),
      tx.study.findMany({
        where: {
          OR: [
            { protocolId: contains },
            { title: contains },
            { sponsor: contains },
            { department: { name: contains } },
          ],
        },
        select: {
          id: true,
          protocolId: true,
          title: true,
          sponsor: true,
          department: { select: { name: true } },
        },
        take: 100,
      }),
      tx.document.findMany({
        where: {
          OR: [{ title: contains }, { typeLabel: contains }, { version: contains }, { study: { protocolId: contains } }],
        },
        select: {
          id: true,
          title: true,
          type: true,
          typeLabel: true,
          version: true,
          visitId: true,
          studyId: true,
          study: { select: { protocolId: true } },
        },
        take: 200,
      }),
      tx.kit.findMany({
        where: { OR: [{ name: contains }, { study: { protocolId: contains } }] },
        select: { id: true, name: true, studyId: true, study: { select: { protocolId: true } } },
        take: 200,
      }),
    ]);

    return {
      patients: subjects
        .filter((s) =>
          matchesAll(`${s.subjectCode} ${s.displayName ?? ""} ${s.study.protocolId} ${humanizeEnum(s.status)}`, terms),
        )
        .slice(0, limit)
        .map((s) => ({
          id: s.id,
          href: `/dashboard/subjects/${s.id}`,
          title: s.subjectCode,
          detail: `${s.study.protocolId}${s.displayName ? ` · ${s.displayName}` : ""}`,
          status: s.status,
        })),
      visits: visits
        .filter((v) =>
          matchesAll(
            `${v.subject.subjectCode} ${v.subject.displayName ?? ""} ${v.study.protocolId} ${v.visitType} ${humanizeEnum(v.status)}`,
            terms,
          ),
        )
        .slice(0, limit)
        .map((v) => ({
          id: v.id,
          href: `/dashboard/visits/${v.id}`,
          title: `${v.subject.subjectCode} · ${v.visitType}`,
          detail: v.study.protocolId,
          status: v.status,
          date: v.targetDate.toISOString(),
        })),
      studies: studies
        .filter((s) =>
          matchesAll(`${s.protocolId} ${s.title} ${s.sponsor ?? ""} ${s.department?.name ?? ""}`, terms),
        )
        .slice(0, limit)
        .map((s) => ({
          id: s.id,
          href: `/dashboard/studies/${s.id}`,
          title: s.protocolId,
          detail: s.title,
        })),
      documents: documents
        .filter((d) =>
          matchesAll(
            `${d.title} ${d.typeLabel ?? ""} ${humanizeEnum(d.type)} ${d.version} ${d.study.protocolId}`,
            terms,
          ),
        )
        .slice(0, limit)
        .map((d) => ({
          id: d.id,
          href: d.visitId ? `/dashboard/visits/${d.visitId}` : `/dashboard/documents?studyId=${d.studyId}`,
          title: d.title,
          detail: `${d.version} · ${d.study.protocolId}`,
          kindLabel: d.typeLabel ?? humanizeEnum(d.type),
        })),
      kits: kits
        .filter((k) => matchesAll(`${k.name} ${k.study.protocolId}`, terms))
        .slice(0, limit)
        .map((k) => ({
          id: k.id,
          href: `/dashboard/kits?studyId=${k.studyId}`,
          title: k.name,
          detail: k.study.protocolId,
        })),
    };
  });
}
