import { CATALOG } from "./catalog";
import type { Locale } from "./config";

// Position of each language in a catalog row (English is the key itself).
const COLUMN: Record<Exclude<Locale, "en">, number> = { fr: 0, de: 1, it: 2, es: 3, pt: 4 };

export type Messages = Record<string, string>;

/** The catalog flattened for one language: English text -> translation. */
export function messagesFor(locale: Locale): Messages {
  if (locale === "en") return {};
  const column = COLUMN[locale];
  const messages: Messages = {};
  for (const [english, row] of Object.entries(CATALOG)) {
    if (row[column]) messages[english] = row[column];
  }
  return messages;
}

/**
 * Looks `key` (the English text) up and fills in `{0}`, `{1}`… from `args`.
 * A text of the form "one|other" is a plural: the first form is used when the
 * first argument is 1 (or whatever the language counts as singular), else the
 * second — e.g. t("{0} kit|{0} kits", [n]).
 */
export function translate(messages: Messages, locale: Locale, key: string, args?: (string | number)[]): string {
  let text = messages[key] ?? key;
  if (text.includes("|")) {
    const [one, other] = text.split("|");
    text = new Intl.PluralRules(locale).select(Number(args?.[0])) === "one" ? one : other;
  }
  if (args) text = text.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? ""));
  return text;
}

export type TFunction = ((key: string, args?: (string | number)[]) => string) & { locale: Locale };

export function makeT(locale: Locale, messages: Messages): TFunction {
  const t = (key: string, args?: (string | number)[]) => translate(messages, locale, key, args);
  return Object.assign(t, { locale });
}
