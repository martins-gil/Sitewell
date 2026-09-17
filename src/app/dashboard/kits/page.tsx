import { getKits, getStudiesWithTemplatesForKits } from "@/lib/queries";
import { formatDate, isWithinDays, isPast } from "@/lib/format";
import { AddKitForm } from "./add-kit-form";
import { DeleteKitButton } from "./delete-kit-button";

export default async function KitsPage() {
  const [kits, studies] = await Promise.all([getKits(), getStudiesWithTemplatesForKits()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kits</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {kits.length} kit{kits.length === 1 ? "" : "s"}. Site inventory of kit batches, optionally
          earmarked for a specific visit type.
        </p>
      </div>

      <AddKitForm studies={studies} />

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
          <thead className="bg-neutral-50 dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Kit</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Study</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Assigned visit</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Expiry</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {kits.map((kit) => {
              const expiringSoon = isWithinDays(kit.expiryDate, 30);
              const expired = isPast(kit.expiryDate);
              return (
                <tr key={kit.id}>
                  <td className="px-4 py-2">{kit.name}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-neutral-500">{kit.study.protocolId}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-neutral-500">
                    {kit.visitScheduleTemplate?.name ?? "—"}
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-2 ${
                      expired
                        ? "font-medium text-red-600 dark:text-red-400"
                        : expiringSoon
                          ? "font-medium text-amber-600 dark:text-amber-400"
                          : "text-neutral-500"
                    }`}
                  >
                    {formatDate(kit.expiryDate)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    <DeleteKitButton kitId={kit.id} />
                  </td>
                </tr>
              );
            })}
            {kits.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-neutral-400">
                  No kits recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
