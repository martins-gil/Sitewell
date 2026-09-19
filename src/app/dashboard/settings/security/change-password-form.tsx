"use client";

import { useRef, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { changePassword } from "./actions";

const inputClass =
  "mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950";

export function ChangePasswordForm() {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const problems: Record<string, string> = {
    WRONG_CURRENT: t("Your current password is wrong."),
    TOO_SHORT: t("The new password must be at least 12 characters."),
    TOO_LONG: t("The new password can be at most 128 characters."),
    CONTAINS_EMAIL: t("The new password can't contain your email address."),
    REPEATED: t("The new password can't be a single repeated character."),
    SAME: t("The new password must be different from the current one."),
  };

  function handleSubmit(formData: FormData) {
    setError(null);
    setDone(false);
    const current = String(formData.get("current") ?? "");
    const next = String(formData.get("next") ?? "");
    if (next !== String(formData.get("repeat") ?? "")) {
      setError(t("The two new passwords don't match."));
      return;
    }
    startTransition(async () => {
      try {
        const result = await changePassword(current, next);
        if (result.ok) {
          formRef.current?.reset();
          setDone(true);
        } else {
          setError(problems[result.problem] ?? t("Something went wrong. Please try again."));
        }
      } catch {
        setError(t("Something went wrong. Please try again."));
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
    >
      <h2 className="text-sm font-medium">{t("Change password")}</h2>
      <div>
        <label className="block text-xs font-medium">{t("Current password")}</label>
        <input type="password" name="current" required autoComplete="current-password" className={inputClass} />
      </div>
      <div>
        <label className="block text-xs font-medium">{t("New password")}</label>
        <input
          type="password"
          name="next"
          required
          minLength={12}
          autoComplete="new-password"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-neutral-500">
          {t("At least 12 characters. A long phrase only you would know is stronger than a short complicated password.")}
        </p>
      </div>
      <div>
        <label className="block text-xs font-medium">{t("Repeat the new password")}</label>
        <input type="password" name="repeat" required autoComplete="new-password" className={inputClass} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-green-700 dark:text-green-400">{t("Password changed.")}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? t("Changing…") : t("Change password")}
      </button>
      <p className="text-xs text-neutral-500">{t("You're signed out automatically after 8 hours.")}</p>
    </form>
  );
}
