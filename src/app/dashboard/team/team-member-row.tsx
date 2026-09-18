"use client";

import { useState, useTransition } from "react";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/badge";
import { updateTeamMember, deleteTeamMember } from "./actions";

const ROLES = ["CRC", "PI", "ORG_ADMIN"] as const;

type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  mfaEnabled: boolean;
  createdAt: Date;
};

export function TeamMemberRow({ member, isSelf }: { member: Member; isSelf: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateTeamMember(member.id, formData);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save.");
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`Remove ${member.name} (${member.email})? This can't be undone.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteTeamMember(member.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete.");
      }
    });
  }

  if (editing) {
    return (
      <tr>
        <td colSpan={6} className="px-4 py-3">
          <form action={handleSave} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium">Name</label>
              <input
                name="name"
                required
                defaultValue={member.name}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium">Email</label>
              <input
                type="email"
                name="email"
                required
                defaultValue={member.email}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium">Role</label>
              <select
                name="role"
                defaultValue={member.role}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs text-neutral-500 hover:underline"
            >
              Cancel
            </button>
          </form>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="px-4 py-2">
        {member.name}
        {isSelf && <span className="ml-2 text-xs text-neutral-400">(you)</span>}
      </td>
      <td className="px-4 py-2 text-neutral-500">{member.email}</td>
      <td className="whitespace-nowrap px-4 py-2">
        <Badge value={member.role} />
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-neutral-500">
        {member.mfaEnabled ? "On" : "Off"}
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-neutral-500">{formatDate(member.createdAt)}</td>
      <td className="whitespace-nowrap px-4 py-2 text-right">
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => setEditing(true)}
            disabled={pending}
            className="text-xs text-neutral-600 hover:underline disabled:opacity-60 dark:text-neutral-400"
          >
            Edit
          </button>
          {!isSelf && (
            <button
              onClick={handleDelete}
              disabled={pending}
              className="text-xs text-red-700 hover:underline disabled:opacity-60 dark:text-red-400"
            >
              Delete
            </button>
          )}
        </div>
        {error && !editing && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}
