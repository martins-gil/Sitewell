"use client";

import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { confirmShipped, declineShipped, type ConfirmProblem } from "./actions";

export type ConfirmState = { confirmedShipped: boolean | null; confirmedAt: string | null; notShippedReason: string | null };

/**
 * "Were these samples shipped?" — like a meeting invite's Yes/No: one click for Yes;
 * clicking No opens a box asking for a short reason before it's sent. `initialAnswer`
 * pre-opens the reason box when the email's own "No" link brought the visitor here.
 */
export function SampleConfirmView({
  token,
  initialAnswer,
  initial,
}: {
  token: string;
  initialAnswer: "yes" | "no" | null;
  initial: ConfirmState;
}) {
  const t = useT();
  const [state, setState] = useState(initial);
  const [showReason, setShowReason] = useState(initialAnswer === "no" && initial.confirmedAt === null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const problems: Record<ConfirmProblem, string> = {
    INVALID_LINK: t("This link is no longer valid."),
    MISSING_REASON: t("Enter a short reason."),
    TOO_MANY: t("Too many attempts. Please wait a few minutes and try again."),
  };

  function yes() {
    setError(null);
    startTransition(async () => {
      const result = await confirmShipped(token);
      if (result.ok) setState(result);
      else setError(problems[result.problem]);
    });
  }

  function no() {
    setError(null);
    if (!reason.trim()) {
      setError(problems.MISSING_REASON);
      return;
    }
    startTransition(async () => {
      const result = await declineShipped(token, reason);
      if (result.ok) setState(result);
      else setError(problems[result.problem]);
    });
  }

  if (state.confirmedAt) {
    return (
      <div className="space-y-3 text-sm">
        {state.confirmedShipped ? (
          <p className="rounded-lg bg-emerald-50 px-4 py-3 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            {t("Recorded: the samples were shipped.")}
          </p>
        ) : (
          <div className="space-y-1 rounded-lg bg-amber-50 px-4 py-3 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <p>{t("Recorded: the samples were NOT shipped.")}</p>
            {state.notShippedReason && <p className="text-amber-800/80 dark:text-amber-300/80">“{state.notShippedReason}”</p>}
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            setState({ confirmedShipped: null, confirmedAt: null, notShippedReason: null });
            setShowReason(false);
            setReason("");
          }}
          className="text-sm text-neutral-500 hover:underline"
        >
          {t("That's wrong — change the answer")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{t("Were these samples shipped?")}</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={yes}
          className="flex-1 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {t("✅ Yes, they were shipped")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setShowReason(true)}
          className="flex-1 rounded-full border border-neutral-300 px-4 py-2.5 text-sm font-medium hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {t("❌ No, they weren't")}
        </button>
      </div>

      {showReason && (
        <div className="space-y-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <label htmlFor="reason" className="block text-sm font-medium">
            {t("Why weren't they shipped?")}
          </label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoFocus
            maxLength={1000}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
          <button
            type="button"
            disabled={pending}
            onClick={no}
            className="w-full rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
          >
            {pending ? t("Sending…") : t("Send")}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
