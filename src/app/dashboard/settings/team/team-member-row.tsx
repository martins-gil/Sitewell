"use client";

import { useState, useTransition } from "react";
import { formatDate, humanizeEnum } from "@/lib/format";
import { Badge } from "@/components/badge";
import { updateTeamMember, deleteTeamMember, resetTeamMemberPassword } from "./actions";
import { teamProblemText } from "./team-problems";
import { useT } from "@/lib/i18n/client";

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
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const resetProblems: Record<string, string> = {
    TOO_SHORT: t("The new password must be at least 12 characters."),
    TOO_LONG: t("The new password can be at most 128 characters."),
    CONTAINS_EMAIL: t("The new password can't contain your email address."),
    REPEATED: t("The new password can't be a single repeated character."),
  };

  // For someone who forgot their password or got locked out: set a new
  // temporary one (they're asked to change it when they sign in).
  function handleReset(formData: FormData) {
    setError(null);
    setResetDone(false);
    startTransition(async () => {
      try {
        const result = await resetTeamMemberPassword(member.id, String(formData.get("temporaryPassword") ?? ""));
        if (result.ok) {
          setResetting(false);
          setResetDone(true);
        } else {
          setError(resetProblems[result.problem] ?? t("Something went wrong. Please try again."));
        }
      } catch {
        setError(t("Something went wrong. Please try again."));
      }
    });
  }

  // onSubmit rather than <form action>: React resets an action's form afterwards,
  // which would wipe what was typed whenever the answer is a problem.
  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const result = await updateTeamMember(member.id, formData);
        if (result.ok) setEditing(false);
        else setError(teamProblemText(t, result.problem, String(formData.get("email") ?? "").trim().toLowerCase()));
      } catch {
        setError(t("Failed to save."));
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(t("Remove {0} ({1})? This can't be undone.", [member.name, member.email]))) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteTeamMember(member.id);
        if (!result.ok) setError(teamProblemText(t, result.problem, member.email));
      } catch {
        setError(t("Failed to delete."));
      }
    });
  }

  if (editing) {
    return (
      <tr>
        <td colSpan={6} className="px-4 py-3">
          <form onSubmit={handleSave} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium">{t("Name")}</label>
              <input
                name="name"
                required
                defaultValue={member.name}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium">{t("Email")}</label>
              <input
                type="email"
                name="email"
                required
                defaultValue={member.email}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium">{t("Role")}</label>
              <select
                name="role"
                defaultValue={member.role}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(humanizeEnum(r))}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
            >
              {pending ? t("Saving…") : t("Save")}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs text-neutral-500 hover:underline"
            >
              {t("Cancel")}</button>
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
        {isSelf && <span className="ml-2 text-xs text-neutral-400">{t("(you)")}</span>}
      </td>
      <td className="px-4 py-2 text-neutral-500">{member.email}</td>
      <td className="whitespace-nowrap px-4 py-2">
        <Badge value={member.role} />
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-neutral-500">
        {member.mfaEnabled ? t("On") : t("Off")}
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-neutral-500">{formatDate(member.createdAt, t.locale)}</td>
      <td className="whitespace-nowrap px-4 py-2 text-right">
        {resetting ? (
          <form action={handleReset} className="flex items-center justify-end gap-2">
            <input
              type="password"
              name="temporaryPassword"
              required
              minLength={12}
              autoFocus
              autoComplete="new-password"
              placeholder={t("At least 12 characters")}
              aria-label={t("Temporary password")}
              className="w-48 rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-950"
            />
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
            >
              {t("Reset")}
            </button>
            <button type="button" onClick={() => setResetting(false)} className="text-xs text-neutral-500 hover:underline">
              {t("Cancel")}
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => setEditing(true)}
              disabled={pending}
              className="text-xs text-neutral-600 hover:underline disabled:opacity-60 dark:text-neutral-400"
            >
              {t("Edit")}</button>
            {!isSelf && (
              <button
                onClick={() => {
                  setResetting(true);
                  setResetDone(false);
                  setError(null);
                }}
                disabled={pending}
                className="text-xs text-neutral-600 hover:underline disabled:opacity-60 dark:text-neutral-400"
              >
                {t("Reset password")}
              </button>
            )}
            {!isSelf && (
              <button
                onClick={handleDelete}
                disabled={pending}
                className="text-xs text-red-700 hover:underline disabled:opacity-60 dark:text-red-400"
              >
                {t("Delete")}</button>
            )}
          </div>
        )}
        {resetDone && (
          <p className="mt-1 whitespace-normal text-xs text-green-700 dark:text-green-400">
            {t("Password reset. They'll be asked to change it after signing in.")}
          </p>
        )}
        {error && !editing && <p className="mt-1 whitespace-normal text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}
