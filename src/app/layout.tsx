import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { getI18n } from "@/lib/i18n/server";
import { getTheme } from "@/lib/preferences-server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SiteWell-ct",
  description: "Clinical trial site platform — patients, visits, and eISF documents.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SiteWell-ct",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // Next's appleWebApp.capable only emits the modern unprefixed
  // mobile-web-app-capable tag; iOS versions before 16.4 need this
  // apple-prefixed one to offer "Add to Home Screen" as a full-screen app.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#171717",
};

// "Match my device": the class is decided in the browser before first paint,
// since the server can't know the device's colour scheme.
const SYSTEM_THEME_SCRIPT = `(function(){try{var e=document.documentElement;if(e.dataset.theme==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches)e.classList.add("dark")}catch(_){}})()`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [{ locale, messages }, theme] = await Promise.all([getI18n(), getTheme()]);

  return (
    <html
      lang={locale}
      data-theme={theme}
      // The system-theme script may add "dark" before React hydrates.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased${theme === "dark" ? " dark" : ""}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SYSTEM_THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
