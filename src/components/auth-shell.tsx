import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { CountryFlags } from "@/components/country-flags";
import { BrandLogo } from "@/components/brand-logo";
import { LoginArt } from "@/components/login-art";
import { LOGIN_IMAGES } from "@/lib/brand";
import { LOGIN_SEQ_COOKIE } from "@/lib/i18n/config";

/**
 * The frame around every page you can open without signing in — sign in, forgot password,
 * choose a new password, request access: a picture that changes with each visit fills the
 * page, and one white card sits in the middle of it with the logo, the title and the form.
 */
export async function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const last = Number((await cookies()).get(LOGIN_SEQ_COOKIE)?.value);
  const index = LOGIN_IMAGES.length > 0 && Number.isInteger(last) && last >= 0 ? (last + 1) % LOGIN_IMAGES.length : 0;

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <LoginArt images={LOGIN_IMAGES} index={index} />

      {/* One row of flags, top right, in place of a language dropdown. */}
      <div className="absolute right-4 top-4 rounded-full bg-black/20 p-1.5 backdrop-blur">
        <CountryFlags />
      </div>

      <div className="relative w-full max-w-md rounded-2xl bg-surface p-8 shadow-2xl sm:p-10">
        <div className="mb-7 flex flex-col items-center text-center">
          <BrandLogo size="login" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
