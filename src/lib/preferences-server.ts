import { cookies } from "next/headers";
import { SECTIONS_COOKIE, THEME_COOKIE, isTheme, type Theme } from "@/lib/i18n/config";
import { parseSectionModes, type SectionModes } from "@/lib/preferences";

export async function getTheme(): Promise<Theme> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : "system";
}

export async function getSectionModes(): Promise<SectionModes> {
  return parseSectionModes((await cookies()).get(SECTIONS_COOKIE)?.value);
}
