"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/translate";

export function Providers({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  return (
    <SessionProvider>
      <I18nProvider locale={locale} messages={messages}>
        {children}
      </I18nProvider>
    </SessionProvider>
  );
}
