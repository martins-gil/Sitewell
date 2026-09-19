"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, SECTIONS_COOKIE, THEME_COOKIE, isLocale, isTheme } from "@/lib/i18n/config";
import { parseSectionModes, type SectionModes } from "@/lib/preferences";

// Display preferences are per browser (cookies), not per account — they're
// needed on the login page too, and the server reads them while rendering.
// Not sensitive, so no auth check; each value is validated before it's stored.
const COOKIE_OPTIONS = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };

export async function setLocale(locale: string) {
  if (!isLocale(locale)) throw new Error("Unsupported language.");
  (await cookies()).set(LOCALE_COOKIE, locale, COOKIE_OPTIONS);
  revalidatePath("/", "layout");
}

export async function setTheme(theme: string) {
  if (!isTheme(theme)) throw new Error("Unsupported theme.");
  (await cookies()).set(THEME_COOKIE, theme, COOKIE_OPTIONS);
  revalidatePath("/", "layout");
}

export async function setSectionModes(modes: SectionModes) {
  const clean = parseSectionModes(JSON.stringify(modes));
  (await cookies()).set(SECTIONS_COOKIE, JSON.stringify(clean), COOKIE_OPTIONS);
  revalidatePath("/dashboard", "layout");
}
