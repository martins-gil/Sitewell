import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { LanguageSelect } from "@/components/language-select";
import { BrandLogo } from "@/components/brand-logo";
import { LoginArt } from "@/components/login-art";
import { LOGIN_IMAGES } from "@/lib/brand";
import { LOGIN_SEQ_COOKIE } from "@/lib/i18n/config";

/**
 * The frame around every page you can open without signing in — sign in, forgot
 * password, choose a new password, request access: the logo and a title over the
 * form, and a rotating picture beside it on a large screen.
 */
export async function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const last = Number((await cookies()).get(LOGIN_SEQ_COOKIE)?.value);
  const index = LOGIN_IMAGES.length > 0 && Number.isInteger(last) && last >= 0 ? (last + 1) % LOGIN_IMAGES.length : 0;

  return (
    <div className="flex min-h-full flex-1">
      <LoginArt images={LOGIN_IMAGES} index={index} />
      <div className="flex flex-1 items-center justify-center bg-neutral-50 px-4 py-12 dark:bg-neutral-950 lg:max-w-xl">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <BrandLogo size="login" />
            <h1 className="mt-4 text-xl font-semibold tracking-tight">{title}</h1>
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
