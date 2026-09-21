"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { resetPassword } from "./actions";

const inputClass =
  "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const problems: Record<string, string> = {
    INVALID_LINK: t("This link has expired or was already used. Ask for a new one."),
    TOO_SHORT: t("The new password must be at least 12 characters."),
    TOO_LONG: t("The new password can be at most 128 characters."),
    CONTAINS_EMAIL: t("The new password can't contain your email address."),
    REPEATED: t("The new password can't be a single repeated character."),
    TOO_MANY: t("Too many attempts. Please wait a few minutes and try again."),
  };

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    const next = String(formData.get("next") ?? "");
    if (next !== String(formData.get("repeat") ?? "")) {
      setError(t("The two new passwords don't match."));
      return;
    }
    startTransition(async () => {
      try {
        const result = await resetPassword(token, next);
        if (result.ok) setDone(true);
        else setError(problems[result.problem] ?? t("Something went wrong. Please try again."));
      } catch {
        setError(t("Something went wrong. Please try again."));
      }
    });
  }

  if (done) {
    return (
      <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <p>{t("Your password has been changed. You can sign in with it now.")}</p>
        <Link
          href="/login"
          className="block w-full rounded-md bg-neutral-900 px-3 py-2 text-center text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          {t("Sign in")}
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div>
        <label htmlFor="next" className="block text-sm font-medium">
          {t("New password")}
        </label>
        <input id="next" type="password" name="next" required minLength={12} autoFocus autoComplete="new-password" className={inputClass} />
        <p className="mt-1 text-xs text-neutral-500">{t("At least 12 characters.")}</p>
      </div>
      <div>
        <label htmlFor="repeat" className="block text-sm font-medium">
          {t("Repeat the new password")}
        </label>
        <input id="repeat" type="password" name="repeat" required minLength={12} autoComplete="new-password" className={inputClass} />
      </div>
      {error && (
        <p className="text-sm text-red-600">
          {error}{" "}
          {error === problems.INVALID_LINK && (
            <Link href="/forgot-password" className="underline">
              {t("Get a new link")}
            </Link>
          )}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? t("Saving…") : t("Change password")}
      </button>
    </form>
  );
}
