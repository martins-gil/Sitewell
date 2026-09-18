import { auth } from "@/auth";
import { getTeamMembers } from "@/lib/queries";
import { AddUserForm } from "./add-user-form";
import { TeamMemberRow } from "./team-member-row";

export default async function TeamPage() {
  const session = await auth();
  const canManage = session?.user?.role === "ORG_ADMIN" || session?.user?.isPlatformAdmin;

  if (!canManage) {
    return (
      <div className="max-w-lg space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-neutral-500">Only an org admin can manage the team.</p>
      </div>
    );
  }

  const members = await getTeamMembers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {members.length} team member{members.length === 1 ? "" : "s"}.
        </p>
      </div>

      <AddUserForm />

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
          <thead className="bg-neutral-50 dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Name</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Email</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Role</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">MFA</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500">Added</th>
              <th className="px-4 py-2 text-left font-medium text-neutral-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {members.map((m) => (
              <TeamMemberRow key={m.id} member={m} isSelf={m.id === session?.user?.id} />
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-neutral-400">
                  No team members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
