import { notFound } from "next/navigation";
import Link from "next/link";
import { getTemplateWithChecklist } from "@/lib/queries";
import { addChecklistTemplateItem, deleteChecklistTemplateItem } from "./actions";
import { DeleteChecklistItemButton } from "./delete-item-button";

export default async function ChecklistTemplatePage({
  params,
}: {
  params: Promise<{ id: string; templateId: string }>;
}) {
  const { id: studyId, templateId } = await params;
  const template = await getTemplateWithChecklist(templateId);
  if (!template) notFound();

  const addItemWithIds = addChecklistTemplateItem.bind(null, studyId, templateId);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href={`/dashboard/studies/${studyId}/templates`} className="text-sm text-neutral-500 hover:underline">
          ← {template.study.protocolId} visit schedule
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{template.name} checklist</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Procedure steps generated on every subject&apos;s {template.name} visit. Fill them in from
          the visit page; download a filled copy as a .docx matching your paper template.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
          <thead className="bg-neutral-50 dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Order</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Item</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Detail</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {template.checklistItems.map((item, i) => (
              <tr key={item.id}>
                <td className="px-4 py-2 text-neutral-500">{i + 1}</td>
                <td className="px-4 py-2 font-medium">{item.label}</td>
                <td className="px-4 py-2 text-neutral-500">{item.detail ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  <DeleteChecklistItemButton
                    studyId={studyId}
                    templateId={templateId}
                    itemId={item.id}
                    onDelete={deleteChecklistTemplateItem}
                  />
                </td>
              </tr>
            ))}
            {template.checklistItems.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-neutral-400">
                  No checklist items yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form action={addItemWithIds} className="space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-sm font-medium text-neutral-500">Add a checklist item</h2>
        <div>
          <label className="block text-xs font-medium">Item</label>
          <input
            name="label"
            required
            placeholder="e.g. Colheita de sangue"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium">Detail (optional)</label>
          <input
            name="detail"
            placeholder="e.g. hematologia, BQ, IgEt"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          Add item
        </button>
      </form>
    </div>
  );
}
