"use client";

import { useTransition } from "react";
import { setLocale } from "@/app/preferences-actions";
import { LOCALES, LOCALE_NAMES } from "@/lib/i18n/config";
import { useT } from "@/lib/i18n/client";

/** Language picker — used in Settings and on the sign-in page. Each language is
 * named in itself so it can be found whatever language the app is showing. */
export function LanguageSelect({ className }: { className?: string }) {
  const t = useT();
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={t.locale}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(async () => {
          await setLocale(next);
        });
      }}
      aria-label={t("Language")}
      className={
        className ??
        "rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950"
      }
    >
      {LOCALES.map((locale) => (
        <option key={locale} value={locale}>
          {LOCALE_NAMES[locale]}
        </option>
      ))}
    </select>
  );
}
