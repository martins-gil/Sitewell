import Link from "next/link";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { EMPTY_RESULTS, searchAll, type SearchHit } from "@/lib/search";
import { Badge } from "@/components/badge";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const t = await getT();
  const { q = "" } = await searchParams;
  const query = q.trim().slice(0, 200);
  const results = query ? await searchAll(query, 30) : EMPTY_RESULTS;

  const groups = [
    { key: "patients", title: t("Patients"), hits: results.patients },
    { key: "visits", title: t("Visits"), hits: results.visits },
    { key: "studies", title: t("Studies"), hits: results.studies },
    { key: "documents", title: t("Documents"), hits: results.documents },
    { key: "kits", title: t("Kits Inventory"), hits: results.kits },
  ].filter((g) => g.hits.length > 0);

  const detailOf = (hit: SearchHit) =>
    [hit.kindLabel ? t(hit.kindLabel) : null, hit.detail, hit.date ? formatDate(hit.date, t.locale) : null]
      .filter(Boolean)
      .join(" · ");

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Search results")}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {query
            ? t("Everything that contains all of: {0}", [query])
            : t("Type in the search box at the top — a patient, a visit, a study… Several terms narrow it down, e.g. RCN-101-0009, week 4.")}
        </p>
      </div>

      {query && groups.length === 0 && (
        <p className="text-sm text-neutral-500">{t("No results for “{0}”.", [query])}</p>
      )}

      {groups.map((group) => (
        <section key={group.key}>
          <h2 className="mb-2 text-sm font-medium text-neutral-500">
            {group.title} ({group.hits.length})
          </h2>
          <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {group.hits.map((hit) => (
              <li key={hit.id}>
                <Link
                  href={hit.href}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
                >
                  <span>
                    <span className="font-medium">{hit.title}</span>
                    <span className="ml-2 text-xs text-neutral-500">{detailOf(hit)}</span>
                  </span>
                  {hit.status && <Badge value={hit.status} />}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
