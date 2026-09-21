import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { LanguageSelect } from "@/components/language-select";
import { BrandLogo } from "@/components/brand-logo";
import { LoginArt } from "@/components/login-art";
import { LOGIN_IMAGES } from "@/lib/brand";
import { getT } from "@/lib/i18n/server";
import { LOGIN_SEQ_COOKIE } from "@/lib/i18n/config";

/**
 * The frame around every page you can open without signing in — sign in, forgot
 * password, choose a new password, request access. Same look as the app: a lavender
 * page, a rounded picture that changes with each visit on a large screen, and one white
 * card holding the logo, the title and the form.
 */
export async function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const t = await getT();
  const last = Number((await cookies()).get(LOGIN_SEQ_COOKIE)?.value);
  const index = LOGIN_IMAGES.length > 0 && Number.isInteger(last) && last >= 0 ? (last + 1) % LOGIN_IMAGES.length : 0;

  return (
    <div className="flex min-h-screen gap-3 p-3 lg:gap-4 lg:p-4">
      <LoginArt images={LOGIN_IMAGES} index={index}>
        <p className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
          {t("Your clinical trial site, all in one place.")}
        </p>
        <p className="mt-2 max-w-md text-sm text-white/80">{t("Patients, visits, kits and samples — organised and always up to date.")}</p>
      </LoginArt>

      <div className="flex flex-1 items-center justify-center lg:max-w-xl lg:flex-none lg:basis-[34rem]">
        <div className="w-full max-w-md rounded-2xl bg-surface p-7 shadow-[var(--shadow-card)] sm:p-9">
          <div className="mb-6 flex flex-col items-center text-center">
            <BrandLogo size="login" />
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
          </div>
          {children}
          <div className="mt-6 flex justify-center">
            <LanguageSelect />
          </div>
        </div>
      </div>
    </div>
  );
}
