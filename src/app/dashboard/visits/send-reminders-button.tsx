"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";

export function SendRemindersButton() {
  const t = useT();
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    setStatus(null);
    const res = await fetch("/api/reminders/run", { method: "POST" });
    const data = await res.json();
    setStatus(t("Sent {0} reminder.|Sent {0} reminders.", [data.remindersSent]));
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={busy}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        {busy ? t("Sending…") : t("Send due reminders")}
      </button>
      {status && <span className="text-xs text-neutral-500">{status}</span>}
    </div>
  );
}
