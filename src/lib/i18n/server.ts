import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { makeT, messagesFor, type Messages, type TFunction } from "./translate";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Translator for server components: `const t = await getT();` */
export async function getT(): Promise<TFunction> {
  const locale = await getLocale();
  return makeT(locale, messagesFor(locale));
}

export async function getI18n(): Promise<{ locale: Locale; messages: Messages }> {
  const locale = await getLocale();
  return { locale, messages: messagesFor(locale) };
}
