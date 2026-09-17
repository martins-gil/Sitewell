"use client";

import { useRef, useState, useTransition } from "react";
import { submitFeedback } from "./actions";

const AREAS = [
  { value: "RECRUITMENT", label: "Patients" },
  { value: "VISITS", label: "Visits" },
  { value: "DOCUMENTS", label: "Documents" },
  { value: "STUDIES", label: "Studies" },
  { value: "LOGIN_AND_SECURITY", label: "Login & Security" },
  { value: "OTHER", label: "Other" },
];

export function FeedbackForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState(3);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await submitFeedback(formData);
        formRef.current?.reset();
        setRating(3);
        setSubmitted(true);
        setTimeout(() => setSubmitted(false), 4000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="space-y-4 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
    >
      <div>
        <label className="block text-xs font-medium">Which part were you using?</label>
        <select
          name="area"
          required
          defaultValue=""
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        >
          <option value="" disabled>
            Select an area
          </option>
          {AREAS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium">
          How easy was it to do what you were trying to do? (1 = very confusing, 5 = very easy)
        </label>
        <div className="mt-1 flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              className={`h-9 w-9 rounded-md border text-sm font-medium ${
                rating === n
                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                  : "border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <input type="hidden" name="easeOfUseRating" value={rating} />
      </div>

      <div>
        <label className="block text-xs font-medium">What was confusing?</label>
        <textarea
          name="confusing"
          rows={2}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>

      <div>
        <label className="block text-xs font-medium">What broke or didn&apos;t work?</label>
        <textarea
          name="broken"
          rows={2}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>

      <div>
        <label className="block text-xs font-medium">
          Anything that would make your day-to-day easier?
        </label>
        <textarea
          name="suggestion"
          rows={2}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {submitted && <p className="text-sm text-green-700 dark:text-green-400">Thanks — feedback sent.</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
