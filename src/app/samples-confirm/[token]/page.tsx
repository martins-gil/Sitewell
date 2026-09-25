import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { withTenantContext } from "@/lib/db-context";
import { readConfirmToken, sampleConfirmContext } from "@/lib/sample-confirm";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { SampleConfirmView } from "../sample-confirm-view";

function Invalid({ title, text }: { title: string; text: string }) {
  return (
    <AuthShell title={title}>
      <div className="space-y-4 text-sm">
        <p className="text-neutral-600 dark:text-neutral-400">{text}</p>
        <Link href="/login" className="inline-block font-medium text-accent hover:underline">
          {"← "}Sign in
        </Link>
      </div>
    </AuthShell>
  );
}

export default async function SampleConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ answer?: string }>;
}) {
  const t = await getT();
  const { token } = await params;
  const { answer } = await searchParams;

  const parts = readConfirmToken(token);
  if (!parts) return <Invalid title={t("This link is no longer valid.")} text={t("Ask whoever sent it for a new one.")} />;

  const shipment = await withTenantContext(sampleConfirmContext(parts), (tx) =>
    tx.labShipment.findUnique({
      where: { id: parts.shipmentId },
      select: {
        awb: true,
        shipDate: true,
        ambientCount: true,
        refrigeratedCount: true,
        frozenCount: true,
        confirmedShipped: true,
        confirmedAt: true,
        notShippedReason: true,
        study: { select: { protocolId: true } },
      },
    }),
  );
  if (!shipment) return <Invalid title={t("This link is no longer valid.")} text={t("This shipment record no longer exists.")} />;

  const total = shipment.ambientCount + shipment.refrigeratedCount + shipment.frozenCount;

  return (
    <AuthShell
      title={t("Confirm the shipment")}
      subtitle={`${shipment.study.protocolId} · AWB ${shipment.awb} · ${formatDate(shipment.shipDate, t.locale)}`}
    >
      <div className="space-y-4">
        <p className="rounded-lg bg-neutral-50 px-4 py-3 text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
          {t("{0} sample|{0} samples", [total])} — {t("{0} ambient, {1} refrigerated, {2} frozen", [shipment.ambientCount, shipment.refrigeratedCount, shipment.frozenCount])}
        </p>
        <SampleConfirmView
          token={token}
          initialAnswer={answer === "no" ? "no" : answer === "yes" ? "yes" : null}
          initial={{
            confirmedShipped: shipment.confirmedShipped,
            confirmedAt: shipment.confirmedAt?.toISOString() ?? null,
            notShippedReason: shipment.notShippedReason,
          }}
        />
      </div>
    </AuthShell>
  );
}
