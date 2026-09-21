import Link from "next/link";
import { notFound } from "next/navigation";
import { getCopySources, getMonitoringVisitById } from "@/lib/monitoring";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { MonitoringDetails } from "./monitoring-details";
import { MonitoringPoints } from "./monitoring-points";

export default async function MonitoringVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const { id } = await params;
  const visit = await getMonitoringVisitById(id);
  if (!visit) notFound();
  const copySources = await getCopySources(visit.studyId, visit.id);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/dashboard/monitoring" className="text-sm text-neutral-500 hover:underline">
          {t("← Monitoring visits")}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {t("Monitoring visit")} · {visit.study.protocolId}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {formatDate(visit.visitDate, t.locale)}
          {visit.startTime ? ` · ${visit.startTime}` : ""}
          {visit.room ? ` · ${visit.room}` : ""}
        </p>
      </div>

      <MonitoringDetails
        id={visit.id}
        values={{
          studyId: visit.study.id,
          protocolId: visit.study.protocolId,
          studyTitle: visit.study.title,
          dateLabel: formatDate(visit.visitDate, t.locale),
          dateInput: visit.visitDate.toISOString().slice(0, 10),
          startTime: visit.startTime ?? "",
          room: visit.room ?? "",
          notes: visit.notes ?? "",
        }}
      />

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-neutral-500">{t("Points to verify")}</h2>
        <MonitoringPoints
          id={visit.id}
          items={visit.items.map((i) => ({ id: i.id, label: i.label, detail: i.detail, verified: i.verified }))}
          sources={copySources.map((s) => ({
            id: s.id,
            label: `${formatDate(s.visitDate, t.locale)}${s.room ? ` · ${s.room}` : ""}`,
            points: s.points,
          }))}
        />
      </section>
    </div>
  );
}
