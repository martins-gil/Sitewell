// Languages the app is translated into. English is the source language: every
// user-facing string in the code IS its English text, looked up in the catalog
// (catalog.ts) — anything missing there falls back to the English text itself.
export const LOCALES = ["en", "fr", "de", "it", "es", "pt"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

// Each language's own name, so it's findable whatever language the app is in.
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  es: "Español",
  pt: "Português",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

// Preferences live in cookies, not the database: they apply per browser, work
// on the login page before anyone is signed in, and the server can read them
// while rendering (no flash of the wrong language or theme).
export const LOCALE_COOKIE = "sw_locale";
export const THEME_COOKIE = "sw_theme";
export const SECTIONS_COOKIE = "sw_sections";

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}
