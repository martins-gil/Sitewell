"use client";

import { useTransition } from "react";
import { setLocale } from "@/app/preferences-actions";
import { LOCALES, LOCALE_NAMES } from "@/lib/i18n/config";
import { useT } from "@/lib/i18n/client";
import { FlagIcon } from "@/components/flag-icons";

// One flag per language on the sign-in pages, in a row, instead of a dropdown — English is
// the Union Jack (there's no single flag for the language itself). Drawn as SVG, not emoji:
// emoji flags don't reliably render as flags on every browser/OS.

export function CountryFlags({ className }: { className?: string }) {
  const t = useT();
  const [pending, startTransition] = useTransition();

  return (
    <div className={className ?? "flex items-center gap-1.5"} role="group" aria-label={t("Language")}>
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          title={LOCALE_NAMES[locale]}
          aria-label={LOCALE_NAMES[locale]}
          aria-pressed={t.locale === locale}
          disabled={pending}
          onClick={() => startTransition(async () => { await setLocale(locale); })}
          className={`flex h-8 w-11 items-center justify-center rounded-md p-0.5 disabled:opacity-60 ${
            t.locale === locale ? "bg-white shadow-sm ring-2 ring-accent" : "bg-white/70 hover:bg-white"
          }`}
        >
          <FlagIcon locale={locale} />
        </button>
      ))}
    </div>
  );
}
