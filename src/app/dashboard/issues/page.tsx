import Link from "next/link";
import { getPendingIssues } from "@/lib/pending-issues";
import { getStudies } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { resolveStudyColors } from "@/lib/study-colors";
import { getT } from "@/lib/i18n/server";
import { AddIssueForm } from "./add-issue-form";
import { IssuesList, type IssueRow } from "./issues-list";

export default async function PendingIssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ studyId?: string }>;
}) {
  const t = await getT();
  const params = await searchParams;

  const [issues, studies] = await Promise.all([getPendingIssues({ studyId: params.studyId }), getStudies()]);
  const colors = resolveStudyColors(studies);

  const rows: IssueRow[] = issues.map((i) => ({
    id: i.id,
    text: i.text,
    protocolId: i.study?.protocolId ?? null,
    colorId: i.studyId ? (colors[i.studyId] ?? "blue") : null,
    dateLabel: formatDate(i.createdAt, t.locale),
  }));

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Pending issues")}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {t("{0} issue open|{0} issues open", [rows.length])}
          </p>
        </div>
        <Link href="/dashboard/issues/history" className="text-sm font-medium text-accent hover:underline">
          {t("History →")}
        </Link>
      </div>

      <AddIssueForm studies={studies} defaultStudyId={params.studyId} />

      <form className="flex flex-wrap items-center gap-3" method="get">
        <select
          name="studyId"
          defaultValue={params.studyId ?? ""}
          aria-label={t("Study")}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        >
          <option value="">{t("All studies")}</option>
          {studies.map((s) => (
            <option key={s.id} value={s.id}>
              {s.protocolId}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {t("Filter")}</button>
      </form>

      <IssuesList issues={rows} />
    </div>
  );
}
