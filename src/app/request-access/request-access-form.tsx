"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { requestAccess } from "./actions";

const inputClass =
  "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950";

export function RequestAccessForm() {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problems: Record<string, string> = {
    NOT_AVAILABLE: t("Requesting access from here isn't set up on this site yet. Please ask your administrator directly."),
    BAD_NAME: t("Enter your name."),
    BAD_EMAIL: t("Enter a valid email address."),
    BAD_PHONE: t("That doesn't look like a phone number. Use the international format, for example +351 912 345 678."),
    TOO_MANY: t("Too many attempts. Please wait a few minutes and try again."),
    SEND_FAILED: t("Your request couldn't be sent. Please try again in a moment."),
  };

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const result = await requestAccess(formData);
        if (result.ok) setSent(true);
        else setError(problems[result.problem] ?? t("Something went wrong. Please try again."));
      } catch {
        setError(t("Something went wrong. Please try again."));
      }
    });
  }

  if (sent) {
    return (
      <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <p>{t("Thank you — your request has been sent to the administrator. You'll be contacted at the email address you gave once your account is ready.")}</p>
        <Link href="/login" className="inline-block font-medium hover:underline">
          {t("← Back to sign in")}
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
        <label htmlFor="name" className="block text-sm font-medium">
          {t("Name")}
        </label>
        <input id="name" name="name" required autoFocus autoComplete="name" maxLength={120} className={inputClass} />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          {t("Email")}
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" maxLength={200} className={inputClass} />
      </div>
      <div>
        <label htmlFor="role" className="block text-sm font-medium">
          {t("Your role")}
        </label>
        <select id="role" name="role" defaultValue="CRC" className={inputClass}>
          <option value="CRC">{t("CRC / study coordinator")}</option>
          <option value="PI">{t("Principal investigator")}</option>
          <option value="OTHER">{t("Other staff")}</option>
        </select>
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-medium">
          {t("Mobile phone (optional)")}
        </label>
        <input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={40} placeholder={t("e.g. +351 912 345 678")} className={inputClass} />
      </div>
      <div>
        <label htmlFor="message" className="block text-sm font-medium">
          {t("Message (optional)")}
        </label>
        <textarea id="message" name="message" rows={3} maxLength={1000} placeholder={t("Which study or team are you joining?")} className={inputClass} />
      </div>
      {/* Honeypot: hidden from people, tempting to bots. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? t("Sending…") : t("Send request")}
      </button>
      <Link href="/login" className="block text-center text-sm text-neutral-600 hover:underline dark:text-neutral-400">
        {t("← Back to sign in")}
      </Link>
    </form>
  );
}
