"use client";

import Image from "next/image";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";

type Step = "idle" | "setup" | "verifying";

export function MfaSettings({ initialEnabled }: { initialEnabled: boolean }) {
  const t = useT();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [step, setStep] = useState<Step>("idle");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function startSetup() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/mfa/setup", { method: "POST" });
    const data = await res.json();
    setQrCodeDataUrl(data.qrCodeDataUrl);
    setSecret(data.secret);
    setStep("setup");
    setBusy(false);
  }

  async function submitCode(endpoint: "/api/mfa/verify" | "/api/mfa/disable") {
    setBusy(true);
    setError(null);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? t("Something went wrong."));
      setBusy(false);
      return;
    }
    setEnabled(endpoint === "/api/mfa/verify");
    setStep("idle");
    setCode("");
    setQrCodeDataUrl(null);
    setSecret(null);
    setBusy(false);
  }

  return (
    <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">{t("Two-factor authentication")}</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {enabled ? t("Enabled — via an authenticator app (TOTP).") : t("Not enabled — via an authenticator app (TOTP).")}
          </p>
        </div>
        {step === "idle" && !enabled && (
          <button
            onClick={startSetup}
            disabled={busy}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
          >
            {t("Enable")}</button>
        )}
        {step === "idle" && enabled && (
          <button
            onClick={() => setStep("verifying")}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {t("Disable")}</button>
        )}
      </div>

      {step === "setup" && qrCodeDataUrl && (
        <div className="mt-4 space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {t("Scan with an authenticator app, then enter the 6-digit code to confirm.")}</p>
          <Image src={qrCodeDataUrl} alt={t("MFA QR code")} width={180} height={180} unoptimized />
          {secret && (
            <p className="font-mono text-xs text-neutral-500">{t("Manual entry key: {0}", [secret])}</p>
          )}
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              placeholder="123456"
              className="w-32 rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
            <button
              onClick={() => submitCode("/api/mfa/verify")}
              disabled={busy || code.length !== 6}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
            >
              {t("Confirm")}</button>
          </div>
        </div>
      )}

      {step === "verifying" && (
        <div className="mt-4 space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {t("Enter a current code to disable two-factor authentication.")}</p>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              placeholder="123456"
              className="w-32 rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
            <button
              onClick={() => submitCode("/api/mfa/disable")}
              disabled={busy || code.length !== 6}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              {t("Disable")}</button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
