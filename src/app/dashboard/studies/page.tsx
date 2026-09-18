import Link from "next/link";
import { auth } from "@/auth";
import { getStudies } from "@/lib/queries";
import { AddStudyForm } from "./add-study-form";

export default async function StudiesPage() {
  const [session, studies] = await Promise.all([auth(), getStudies()]);
  const canManage = session?.user?.role === "ORG_ADMIN" || session?.user?.isPlatformAdmin;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Studies</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {studies.length} stud{studies.length === 1 ? "y" : "ies"}.
        </p>
      </div>

      {canManage && <AddStudyForm />}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
          <thead className="bg-neutral-50 dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Protocol</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Title</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Status</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {studies.map((s) => (
              <tr key={s.id}>
                <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">{s.protocolId}</td>
                <td className="px-4 py-2">{s.title}</td>
                <td className="whitespace-nowrap px-4 py-2 text-neutral-500">{s.status}</td>
                <td className="whitespace-nowrap px-4 py-2">
                  <Link
                    href={`/dashboard/studies/${s.id}/templates`}
                    className="text-sm text-neutral-600 hover:underline dark:text-neutral-400"
                  >
                    Details & schedule →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
