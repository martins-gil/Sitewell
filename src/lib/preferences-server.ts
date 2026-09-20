import { cookies } from "next/headers";
import { SECTIONS_COOKIE, SIDEBAR_COOKIE, THEME_COOKIE, isTheme, type Theme } from "@/lib/i18n/config";
import {
  DEFAULT_SIDEBAR_COLOR,
  isSidebarColor,
  parseSectionModes,
  type SectionModes,
  type SidebarColorId,
} from "@/lib/preferences";

export async function getTheme(): Promise<Theme> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : "system";
}

export async function getSidebarColor(): Promise<SidebarColorId> {
  const value = (await cookies()).get(SIDEBAR_COOKIE)?.value;
  return isSidebarColor(value) ? value : DEFAULT_SIDEBAR_COLOR;
}

export async function getSectionModes(): Promise<SectionModes> {
  return parseSectionModes((await cookies()).get(SECTIONS_COOKIE)?.value);
}
