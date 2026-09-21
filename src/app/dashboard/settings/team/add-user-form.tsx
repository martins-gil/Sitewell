"use client";

import { useState, useTransition } from "react";
import { humanizeEnum } from "@/lib/format";
import { addTeamMember } from "./actions";
import { useT } from "@/lib/i18n/client";

const ROLES = ["CRC", "PI", "ORG_ADMIN"] as const;

// Someone who asked for access (src/app/request-access) arrives here through the link in
// the admin's email, with their details filled in.
export type AddUserPrefill = { name?: string; email?: string; role?: string; phone?: string };

export function AddUserForm({ prefill }: { prefill?: AddUserPrefill }) {
  const t = useT();
  const [open, setOpen] = useState(Boolean(prefill?.email || prefill?.name));
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
            defaultValue={prefill?.name}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium">{t("Role")}</label>
          <select
            name="role"
            defaultValue={prefill?.role && (ROLES as readonly string[]).includes(prefill.role) ? prefill.role : "CRC"}
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
            defaultValue={prefill?.email}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium">{t("Temporary password")}</label>
          <input
            type="password"
            name="password"
            required
            minLength={12}
            placeholder={t("At least 12 characters")}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium">{t("Mobile phone (optional)")}</label>
          <input
            type="tel"
            name="phone"
            defaultValue={prefill?.phone}
            placeholder={t("e.g. +351 912 345 678")}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
        <label className="flex items-start gap-2 self-end pb-1.5 text-xs">
          <input type="checkbox" name="smsAsked" className="mt-0.5" />
          <span>
            {t("This person asked to receive text messages about visits")}
            <span className="block text-neutral-500">{t("They can change it themselves under Settings → Notifications.")}</span>
          </span>
        </label>
      </div>
      <p className="text-xs text-neutral-500">
        {t("Share this password with them directly — there's no invite email yet. They'll be asked to change it after signing in.")}</p>
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
