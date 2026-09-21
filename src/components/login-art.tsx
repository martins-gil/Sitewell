"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { LOGIN_SEQ_COOKIE } from "@/lib/i18n/config";

/**
 * The picture beside the sign-in form (large screens only), a rounded panel that floats on
 * the page like the rest of the app. Which one is chosen on the server — the one after
 * the last one this browser saw — and this remembers the choice in a cookie so the NEXT
 * visit shows the next picture. With no pictures set up it is a plain coloured panel.
 * `children` is laid over the bottom of the picture (a caption).
 */
export function LoginArt({ images, index, children }: { images: string[]; index: number; children?: ReactNode }) {
  useEffect(() => {
    if (images.length === 0) return;
    try {
      document.cookie = `${LOGIN_SEQ_COOKIE}=${index}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      // Cookies blocked: the picture just doesn't rotate.
    }
  }, [images.length, index]);

  return (
    <div className="relative hidden flex-1 overflow-hidden rounded-2xl bg-gradient-to-br from-[#12284c] via-[#1d4e89] to-[#0f5257] shadow-[var(--shadow-card)] lg:block">
      {images.length > 0 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={images[index % images.length]} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
      )}
      {children && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-neutral-950/75 via-neutral-950/35 to-transparent p-8 pt-24 text-white">
          {children}
        </div>
      )}
    </div>
  );
}
