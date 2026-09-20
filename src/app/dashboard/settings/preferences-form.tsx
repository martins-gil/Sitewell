"use client";

import { useState, useTransition } from "react";
import { setSectionModes, setSidebarColor, setTheme } from "@/app/preferences-actions";
import { LanguageSelect } from "@/components/language-select";
import { useT } from "@/lib/i18n/client";
import type { Theme } from "@/lib/i18n/config";
import {
  PATIENT_SECTIONS,
  SIDEBAR_COLORS,
  VISIT_SECTIONS,
  type SectionMode,
  type SectionModes,
  type SidebarColorId,
} from "@/lib/preferences";

// Apply the theme right away, without waiting for the server round-trip.
function applyThemeNow(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
}

export function PreferencesForm({
  theme,
  sectionModes,
  sidebarColor,
}: {
  theme: Theme;
  sectionModes: SectionModes;
  sidebarColor: SidebarColorId;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [chosenTheme, setChosenTheme] = useState(theme);
  const [chosenSidebar, setChosenSidebar] = useState(sidebarColor);

  function chooseSidebar(next: SidebarColorId) {
    setChosenSidebar(next);
    setError(null);
    startTransition(async () => {
      try {
        await setSidebarColor(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("Failed to save."));
      }
    });
  }
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
        <div className="border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <span className="block text-sm">{t("Colour of the left bar")}</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {SIDEBAR_COLORS.map((c) => (
              <label key={c.id} title={t(c.label)} className="cursor-pointer">
                <input
                  type="radio"
                  name="sidebar"
                  value={c.id}
                  checked={chosenSidebar === c.id}
                  onChange={() => chooseSidebar(c.id)}
                  className="peer sr-only"
                  aria-label={t(c.label)}
                />
                <span
                  className="block h-7 w-7 rounded-full ring-2 ring-neutral-300 ring-offset-2 ring-offset-white peer-checked:ring-neutral-900 peer-focus-visible:ring-neutral-500 dark:ring-neutral-700 dark:ring-offset-neutral-950 dark:peer-checked:ring-white"
                  style={{ backgroundColor: c.bg ?? "#e5e5e5" }}
                />
              </label>
            ))}
          </div>
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
