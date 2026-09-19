"use client";

import { useState, useTransition } from "react";
import { humanizeEnum } from "@/lib/format";
import { addTeamMember } from "./actions";
import { useT } from "@/lib/i18n/client";

const ROLES = ["CRC", "PI", "ORG_ADMIN"] as const;

export function AddUserForm() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await addTeamMember(formData);
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("Failed to add user."));
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
      >
        {t("+ Add team member")}</button>
    );
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-500">{t("Add a team member")}</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500 hover:underline">
          {t("Cancel")}</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium">{t("Name")}</label>
          <input
            name="name"
            required
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium">{t("Role")}</label>
          <select
            name="role"
            defaultValue="CRC"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(humanizeEnum(r))}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium">{t("Email")}</label>
          <input
            type="email"
            name="email"
            required
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium">{t("Temporary password")}</label>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            placeholder={t("At least 8 characters")}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
      </div>
      <p className="text-xs text-neutral-500">
        {t("Share this password with them directly — there's no invite email or self-service password change yet, so this is the password they'll sign in with.")}</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? t("Adding…") : t("Add team member")}
      </button>
    </form>
  );
}
