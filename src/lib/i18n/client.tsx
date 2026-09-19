"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "./config";
import { makeT, type Messages, type TFunction } from "./translate";

const I18nContext = createContext<{ locale: Locale; messages: Messages }>({ locale: "en", messages: {} });

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Translator for client components: `const t = useT();` */
export function useT(): TFunction {
  const { locale, messages } = useContext(I18nContext);
  return useMemo(() => makeT(locale, messages), [locale, messages]);
}
