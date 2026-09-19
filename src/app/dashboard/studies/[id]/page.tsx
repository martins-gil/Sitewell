import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getDepartments, getStudies, getStudyById, getStudyProtocolDocument, getSubjects } from "@/lib/queries";
import { resolveStudyColors, studyColor } from "@/lib/study-colors";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/badge";
import { EditStudyForm } from "@/app/dashboard/studies/edit-study-form";
import { PiSiteForm } from "./pi-site-form";
import { getT } from "@/lib/i18n/server";

export default async function StudyOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getT();
  const { id } = await params;
  const [session, study, patients, protocol, departments, allStudies] = await Promise.all([
    auth(),
    getStudyById(id),
    getSubjects({ studyId: id }),
    getStudyProtocolDocument(id),
    getDepartments(),
    getStudies(),
  ]);
  if (!study) notFound();
  const colorId = resolveStudyColors(allStudies)[study.id] ?? "blue";
  const departmentName = departments.find((d) => d.id === study.departmentId)?.name ?? null;
  const canManage = session?.user?.role === "ORG_ADMIN" || session?.user?.isPlatformAdmin;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/studies" className="text-sm text-neutral-500 hover:underline">
          {t("← Studies")}</Link>
        <div className="mt-1 flex items-center gap-3">
          <span
            aria-hidden
            className="inline-block h-4 w-4 rounded-full"
            style={{ backgroundColor: studyColor(colorId) }}
          />
          <h1 className="text-2xl font-semibold tracking-tight">{study.protocolId}</h1>
          <Badge value={study.status} />
        </div>
        <p className="mt-1 text-sm text-neutral-500">{study.title}</p>
        <p className="mt-1 text-xs text-neutral-500">
          {study.phase && <>{study.phase} · </>}
          {study.sponsor ?? t("Sponsor not set")} · {departmentName ?? t("No department")}
        </p>
        <Link
          href={`/dashboard/studies/${study.id}/templates`}
          className="mt-2 inline-block text-sm text-neutral-600 hover:underline dark:text-neutral-400"
        >
          {t("Visit schedule →")}</Link>
      </div>

      {canManage && (
        <EditStudyForm
          studyId={study.id}
          study={{
            protocolId: study.protocolId,
            title: study.title,
            phase: study.phase,
            sponsor: study.sponsor,
            status: study.status,
            departmentId: study.departmentId,
            color: colorId,
          }}
          departments={departments}
        />
      )}

      <PiSiteForm
        studyId={study.id}
        piName={study.piName}
        siteNumber={study.sites[0]?.siteNumber ?? null}
        protocol={
          protocol
            ? {
                version: protocol.doc.version,
                releaseLabel: formatDate(protocol.doc.releaseDate, t.locale),
                awaitingSignature: protocol.awaitingSignature,
              }
            : null
        }
      />

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <h2 className="text-sm font-medium text-neutral-500">
            {t("Patients")} {patients.length > 0 && `(${patients.length})`}
          </h2>
        </div>
        <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
          <thead className="bg-neutral-50 dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">{t("Subject")}</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">{t("Initials / name")}</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">{t("Stage")}</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">{t("Added")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {patients.map((p) => (
              <tr key={p.id}>
                <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">
                  <Link href={`/dashboard/subjects/${p.id}`} className="hover:underline">
                    {p.subjectCode}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-2">{p.displayName ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-2">
                  <Badge value={p.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-neutral-500">{formatDate(p.createdAt, t.locale)}</td>
              </tr>
            ))}
            {patients.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-neutral-400">
                  {t("No patients in this study yet.")}</td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="border-t border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
          <Link
            href={`/dashboard/subjects?studyId=${study.id}`}
            className="text-sm text-neutral-600 hover:underline dark:text-neutral-400"
          >
            {t("Open in Patients (add a new one here) →")}</Link>
        </div>
      </div>
    </div>
  );
}
