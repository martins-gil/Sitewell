"use client";

import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { saveMyNotifications, sendTestMessage, type TestMessageResult } from "./actions";

const inputClass =
  "mt-1 w-full max-w-sm rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950";

/**
 * "Messages about the coming week": whether to get the Wednesday / Thursday email,
 * whether to also get a text message (needs a number and the person's own yes),
 * and a button that sends them a test right now.
 */
export function NotificationsForm({
  initial,
  emailProvider,
  smsProvider,
}: {
  initial: { phone: string; notifyEmail: boolean; notifySms: boolean };
  emailProvider: boolean;
  smsProvider: boolean;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<Extract<TestMessageResult, { ok: true }> | null>(null);
  const [testing, startTest] = useTransition();

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveMyNotifications(formData);
        if (result.ok) setMessage(t("Saved."));
        else setError(result.problem);
      } catch {
        setError(t("Something went wrong. Please try again."));
      }
    });
  }

  function handleTest() {
    setTest(null);
    setError(null);
    startTest(async () => {
      try {
        const result = await sendTestMessage();
        if (result.ok) setTest(result);
        else setError(result.problem);
      } catch {
        setError(t("Something went wrong. Please try again."));
      }
    });
  }

  const outcome = (what: "sent" | "logged" | "failed" | "off", channel: string) =>
    what === "sent"
      ? t("{0}: sent.", [channel])
      : what === "logged"
        ? t("{0}: not sent — no service is connected to this site yet, so it was only written to the server log.", [channel])
        : what === "failed"
          ? t("{0}: it could not be sent — check the connection settings.", [channel])
          : t("{0}: not sent — turn it on above and save first.", [channel]);

  return (
    <div className="space-y-4">
      <form onSubmit={handleSave} className="space-y-4 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <div>
          <h2 className="text-sm font-medium">{t("Messages about the coming week")}</h2>
          <p className="mt-1 text-xs text-neutral-500">
            {t("On Wednesdays and Thursdays you get a message listing the visits planned for the following week — patients' visits and monitoring visits.")}
          </p>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="notifyEmail" defaultChecked={initial.notifyEmail} className="mt-0.5" />
          <span>{t("Send me an email")}</span>
        </label>

        <div>
          <label htmlFor="phone" className="block text-xs font-medium">
            {t("Mobile phone number")}
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={initial.phone}
            placeholder={t("e.g. +351 912 345 678")}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-neutral-500">
            {t("International format. A nine-digit Portuguese mobile number is read as +351.")}
          </p>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="notifySms" defaultChecked={initial.notifySms} className="mt-0.5" />
          <span>
            {t("Also send me a text message")}
            <span className="block text-xs text-neutral-500">
              {t("I agree to receive text messages from SiteWell-ct about upcoming visits at this number. I can turn this off here at any time.")}
            </span>
          </span>
        </label>

        {(!emailProvider || !smsProvider) && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {!emailProvider && !smsProvider
              ? t("Email and text messages aren't connected to this site yet, so nothing is actually sent until an administrator sets them up.")
              : !emailProvider
                ? t("Email isn't connected to this site yet, so emails aren't actually sent until an administrator sets it up.")
                : t("Text messages aren't connected to this site yet, so texts aren't actually sent until an administrator sets them up.")}
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && !error && <p className="text-sm text-green-700 dark:text-green-400">{message}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
          >
            {pending ? t("Saving…") : t("Save")}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {testing ? t("Sending…") : t("Send me a test message")}
          </button>
        </div>
      </form>

      {test && (
        <div className="space-y-1 rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
          <p>{outcome(test.email, t("Email"))}</p>
          <p>{outcome(test.sms, t("Text message"))}</p>
          {test.usedExample && (
            <p className="text-xs text-neutral-500">
              {t("There are no visits planned for next week, so the message used two example lines.")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
