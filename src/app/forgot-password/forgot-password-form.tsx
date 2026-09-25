"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { requestPasswordReset } from "./actions";

export function ForgotPasswordForm() {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const result = await requestPasswordReset(formData);
        if (result.ok) setSent(true);
        else
          setError(
            result.problem === "NOT_AVAILABLE"
              ? t("Resetting a password by email isn't set up on this site yet. Ask your administrator to reset it for you.")
              : result.problem === "BAD_EMAIL"
                ? t("Enter a valid email address.")
                : t("Too many attempts. Please wait a few minutes and try again."),
          );
      } catch {
        setError(t("Something went wrong. Please try again."));
      }
    });
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <p>{t("If that email address has an account, we've sent it a link to choose a new password. The link works for one hour.")}</p>
        <p className="text-neutral-500">{t("Nothing arrived? Check your spam folder, or ask your administrator.")}</p>
        <Link href="/login" className="inline-block font-medium hover:underline">
          {t("← Back to sign in")}
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          {t("Email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoFocus
          autoComplete="email"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>
      {/* Honeypot: hidden from people, tempting to bots. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? t("Sending…") : t("Send me a reset link")}
      </button>
      <Link href="/login" className="block text-center text-sm text-neutral-600 hover:underline dark:text-neutral-400">
        {t("← Back to sign in")}
      </Link>
    </form>
  );
}
