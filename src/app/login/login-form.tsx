"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";

/**
 * Where to go after signing in. Someone who followed a link into the app (a
 * visit in their calendar, say) is sent to `?callbackUrl=` by the middleware;
 * honour it so they land on that page. Only a same-origin /dashboard address is
 * accepted — anything else falls back to the dashboard, so this can't be used
 * as an open redirect.
 */
function afterSignInPath(): string {
  try {
    const raw = new URLSearchParams(window.location.search).get("callbackUrl");
    if (raw) {
      const wanted = new URL(raw, window.location.origin);
      if (wanted.origin === window.location.origin && /^\/dashboard(\/|$)/.test(wanted.pathname)) {
        return wanted.pathname + wanted.search;
      }
    }
  } catch {
    // Malformed address: use the default.
  }
  return "/dashboard";
}

export function LoginForm() {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (!mfaRequired) {
        const res = await fetch("/api/login/precheck", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const { mfaRequired: needsMfa } = await res.json();
        if (needsMfa) {
          setMfaRequired(true);
          setSubmitting(false);
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        mfaCode: mfaRequired ? mfaCode : undefined,
        redirect: false,
      });

      if (result?.error) {
        setError(
          `${mfaRequired ? t("Invalid code.") : t("Invalid email or password.")} ${t("After 5 wrong attempts an account is locked for 15 minutes.")}`,
        );
        setSubmitting(false);
        return;
      }

      router.push(afterSignInPath());
      router.refresh();
    } catch {
      setError(t("Something went wrong. Please try again."));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          {t("Email")}</label>
        <input
          id="email"
          type="email"
          required
          disabled={mfaRequired}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          {t("Password")}</label>
        <input
          id="password"
          type="password"
          required
          disabled={mfaRequired}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950"
        />
      </div>
      {mfaRequired && (
        <div>
          <label htmlFor="mfaCode" className="block text-sm font-medium">
            {t("Authenticator code")}</label>
          <input
            id="mfaCode"
            type="text"
            inputMode="numeric"
            autoFocus
            required
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-neutral-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {mfaRequired ? t("Verify") : t("Sign in")}
      </button>
    </form>
  );
}
