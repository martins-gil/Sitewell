import { notFound } from "next/navigation";
import Link from "next/link";
import { getStudyWithTemplates } from "@/lib/queries";
import { addVisitTemplate, deleteVisitTemplate } from "./actions";
import { DeleteTemplateButton } from "./delete-template-button";

export default async function VisitTemplatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const study = await getStudyWithTemplates(id);
  if (!study) notFound();

  const addTemplateWithId = addVisitTemplate.bind(null, study.id);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href={`/dashboard/studies/${study.id}`} className="text-sm text-neutral-500 hover:underline">
          ← {study.protocolId}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {study.protocolId} visit schedule
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Defines the protocol visits generated automatically when a subject in this study is
          marked Enrolled.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
          <thead className="bg-neutral-50 dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Order</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Visit name</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Target day offset</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Window</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500"></th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {study.templates.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2 text-neutral-500">{t.sortOrder}</td>
                <td className="px-4 py-2">{t.name}</td>
                <td className="px-4 py-2">Day {t.targetDayOffset}</td>
                <td className="px-4 py-2 text-neutral-500">
                  −{t.windowBeforeDays} / +{t.windowAfterDays} days
                </td>
                <td className="px-4 py-2">
                  <Link
                    href={`/dashboard/studies/${study.id}/templates/${t.id}/checklist`}
                    className="text-neutral-600 hover:underline dark:text-neutral-400"
                  >
                    Checklist →
                  </Link>
                </td>
                <td className="px-4 py-2 text-right">
                  <DeleteTemplateButton studyId={study.id} templateId={t.id} onDelete={deleteVisitTemplate} />
                </td>
              </tr>
            ))}
            {study.templates.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-neutral-400">
                  No visits defined yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form action={addTemplateWithId} className="space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-sm font-medium text-neutral-500">Add a visit</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium">Visit name</label>
            <input
              name="name"
              required
              placeholder="e.g. Week 8"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
          </div>
          <div>
            <label className="block text-xs font-medium">Target day offset</label>
            <input
              type="number"
              name="targetDayOffset"
              required
              placeholder="0"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
          </div>
          <div />
          <div>
            <label className="block text-xs font-medium">Window before (days)</label>
            <input
              type="number"
              name="windowBeforeDays"
              defaultValue={0}
              min={0}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
          </div>
          <div>
            <label className="block text-xs font-medium">Window after (days)</label>
            <input
              type="number"
              name="windowAfterDays"
              defaultValue={0}
              min={0}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
          </div>
        </div>
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          Add visit
        </button>
      </form>
    </div>
  );
}