"use client";

import { useState, useTransition } from "react";
import { setSectionModes, setTheme } from "@/app/preferences-actions";
import { LanguageSelect } from "@/components/language-select";
import { useT } from "@/lib/i18n/client";
import type { Theme } from "@/lib/i18n/config";
import { PATIENT_SECTIONS, VISIT_SECTIONS, type SectionMode, type SectionModes } from "@/lib/preferences";

// Apply the theme right away, without waiting for the server round-trip.
function applyThemeNow(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
}

export function PreferencesForm({ theme, sectionModes }: { theme: Theme; sectionModes: SectionModes }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [chosenTheme, setChosenTheme] = useState(theme);
  const [modes, setModes] = useState(sectionModes);
  const [error, setError] = useState<string | null>(null);

  function chooseTheme(next: Theme) {
    setChosenTheme(next);
    applyThemeNow(next);
    setError(null);
    startTransition(async () => {
      try {
        await setTheme(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("Failed to save."));
      }
    });
  }

  function chooseMode(id: keyof SectionModes, mode: SectionMode) {
    const next = { ...modes, [id]: mode };
    setModes(next);
    setError(null);
    startTransition(async () => {
      try {
        await setSectionModes(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("Failed to save."));
      }
    });
  }

  const themes: { value: Theme; label: string }[] = [
    { value: "light", label: t("Light — white background") },
    { value: "dark", label: t("Dark — black background") },
    { value: "system", label: t("Match my device") },
  ];

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-sm font-medium text-neutral-500">{t("Language")}</h2>
        <LanguageSelect />
        <p className="text-xs text-neutral-500">
          {t("The Word documents (.docx) keep the wording of your site's paper forms, whatever language the app is in.")}
        </p>
      </section>

      <section className="space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-sm font-medium text-neutral-500">{t("Appearance")}</h2>
        <div className="space-y-2">
          {themes.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="theme"
                value={option.value}
                checked={chosenTheme === option.value}
                onChange={() => chooseTheme(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </section>

      {[
        { title: t("Sections on a visit's page"), sections: VISIT_SECTIONS, note: true },
        { title: t("Sections on a patient's page"), sections: PATIENT_SECTIONS, note: false },
      ].map((group) => (
        <section
          key={group.title}
          className="space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
        >
          <div>
            <h2 className="text-sm font-medium text-neutral-500">{group.title}</h2>
            {group.note && (
              <p className="mt-1 text-xs text-neutral-500">
                {t("Show each section, keep it collapsed (one click opens it), or hide it from the visit page altogether.")}
              </p>
            )}
          </div>
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {group.sections.map((section) => (
              <li key={section.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                <span>{t(section.label)}</span>
                <select
                  value={modes[section.id]}
                  onChange={(e) => chooseMode(section.id, e.target.value as SectionMode)}
                  aria-label={t(section.label)}
                  className="rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                >
                  <option value="show">{t("Shown")}</option>
                  <option value="collapsed">{t("Collapsed")}</option>
                  <option value="hidden">{t("Hidden")}</option>
                </select>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {pending && <p className="text-xs text-neutral-500">{t("Saving…")}</p>}
    </div>
  );
}
