"use client";

import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { createCalendarLink, turnOffCalendarLink } from "./calendar-share-actions";

/**
 * "Share this calendar": a private link that Apple Calendar, Google Calendar
 * and Outlook subscribe to (so their copy keeps itself up to date), plus a
 * one-time .ics download. Each visit in it carries the study, the visit, its
 * kits and a link straight back to that visit here.
 */
export function CalendarShare({ feedUrl }: { feedUrl: string | null }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean }>, done: string) {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await action();
        setMessage(result.ok ? done : t("Something went wrong. Please try again."));
      } catch {
        setMessage(t("Something went wrong. Please try again."));
      }
    });
  }

  async function copy() {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setMessage(t("Link copied."));
    } catch {
      setMessage(t("Couldn't copy — select the link and copy it by hand."));
    }
  }

  const button =
    "rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800";

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-neutral-600 hover:underline dark:text-neutral-400"
      >
        {open ? t("Hide calendar sharing") : t("Share this calendar (Apple, Google, Outlook) →")}
      </button>

      {open && (
        <div className="space-y-4 rounded-lg border border-neutral-200 p-5 text-sm dark:border-neutral-800">
          <p className="text-neutral-600 dark:text-neutral-400">
            {t("Add the visits to your own calendar app. Each one shows the study, the patient, the visit, its kits, and a link that opens that exact visit here. Your calendar app keeps itself up to date.")}
          </p>

          {feedUrl ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium">{t("Your private calendar link")}</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  <input
                    readOnly
                    value={feedUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-w-[16rem] flex-1 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-1.5 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-900"
                  />
                  <button type="button" onClick={copy} className={button}>
                    {t("Copy link")}
                  </button>
                </div>
              </div>

              <ul className="space-y-2 text-neutral-700 dark:text-neutral-300">
                <li>
                  <span className="font-medium">{t("iPhone, iPad, Mac:")}</span>{" "}
                  <a href={feedUrl.replace(/^https?:/, "webcal:")} className="underline">
                    {t("Add to Apple Calendar")}
                  </a>
                  {" — "}
                  {t("or Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar, and paste the link.")}
                </li>
                <li>
                  <span className="font-medium">{t("Google Calendar:")}</span>{" "}
                  {t("on a computer, open Google Calendar → Other calendars (+) → From URL, and paste the link. Google refreshes it every few hours.")}
                </li>
                <li>
                  <span className="font-medium">{t("Outlook:")}</span>{" "}
                  {t("Add calendar → Subscribe from web (Outlook on the web) or Add Calendar → From Internet (desktop Outlook), and paste the link.")}
                </li>
              </ul>

              <p className="text-xs text-neutral-500">
                {t("Anyone who has this link can see your visits (patient codes and study names), so keep it to yourself. If it gets out, make a new link — the old one stops working.")}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <a href="/api/calendar-download" className={button}>
                  {t("Download a copy (.ics)")}
                </a>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(createCalendarLink, t("Made a new link — the old one no longer works."))}
                  className={button}
                >
                  {t("Make a new link")}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(turnOffCalendarLink, t("Sharing is off."))}
                  className={`${button} text-red-700 dark:text-red-400`}
                >
                  {t("Turn sharing off")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => run(createCalendarLink, t("Your link is ready."))}
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
              >
                {pending ? t("Creating…") : t("Create my calendar link")}
              </button>
              <a href="/api/calendar-download" className={button}>
                {t("Download a copy (.ics)")}
              </a>
            </div>
          )}

          {message && <p className="text-xs text-green-700 dark:text-green-400">{message}</p>}
        </div>
      )}
    </div>
  );
}
