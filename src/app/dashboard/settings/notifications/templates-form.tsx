"use client";

import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { PLACEHOLDERS, TEMPLATE_LIMITS, type VisitAlertTemplates } from "@/lib/visit-alert-templates";
import { resetAlertTemplates, saveAlertTemplates } from "./actions";

const inputClass =
  "mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950";

/** For an organization admin: the wording of the weekly email and text message. */
export function TemplatesForm({ templates, custom }: { templates: VisitAlertTemplates; custom: boolean }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Remounts the fields after "back to standard" so they show the standard wording.
  const [formKey, setFormKey] = useState(0);

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveAlertTemplates(formData);
        if (result.ok) setMessage(t("Saved."));
        else setError(result.problem);
      } catch {
        setError(t("Something went wrong. Please try again."));
      }
    });
  }

  function handleReset() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const result = await resetAlertTemplates();
        if (result.ok) {
          setFormKey((k) => k + 1);
          setMessage(t("Back to the standard wording."));
        } else setError(result.problem);
      } catch {
        setError(t("Something went wrong. Please try again."));
      }
    });
  }

  return (
    <form
      key={formKey}
      onSubmit={handleSave}
      className="space-y-4 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
    >
      <div>
        <h2 className="text-sm font-medium">{t("Wording of the messages")}</h2>
        <p className="mt-1 text-xs text-neutral-500">
          {t("Write the message your way. These words are replaced for each person:")}{" "}
          {PLACEHOLDERS.map((p) => (
            <code key={p} className="mr-1.5 rounded bg-neutral-100 px-1 py-0.5 text-[11px] dark:bg-neutral-800">
              {p}
            </code>
          ))}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {t("{name} = first name, {week} = the week, {count} = number of visits, {visits} = the list, {link} = the calendar's address.")}
        </p>
      </div>

      <div>
        <label htmlFor="emailSubject" className="block text-xs font-medium">
          {t("Email subject")}
        </label>
        <input
          id="emailSubject"
          name="emailSubject"
          required
          maxLength={TEMPLATE_LIMITS.emailSubject}
          defaultValue={templates.emailSubject}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="emailBody" className="block text-xs font-medium">
          {t("Email text")}
        </label>
        <textarea
          id="emailBody"
          name="emailBody"
          required
          rows={9}
          maxLength={TEMPLATE_LIMITS.emailBody}
          defaultValue={templates.emailBody}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="smsBody" className="block text-xs font-medium">
          {t("Text message")}
        </label>
        <textarea
          id="smsBody"
          name="smsBody"
          required
          rows={3}
          maxLength={TEMPLATE_LIMITS.smsBody}
          defaultValue={templates.smsBody}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-neutral-500">
          {t("Keep it short: a text is trimmed to about 480 characters, and the list of visits is shortened to fit.")}
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && !error && <p className="text-sm text-green-700 dark:text-green-400">{message}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          {pending ? t("Saving…") : t("Save wording")}
        </button>
        {custom && (
          <button type="button" onClick={handleReset} disabled={pending} className="text-sm text-neutral-600 hover:underline dark:text-neutral-400">
            {t("Back to the standard wording")}
          </button>
        )}
      </div>
    </form>
  );
}
