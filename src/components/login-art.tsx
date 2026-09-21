"use client";

import { useEffect } from "react";
import { LOGIN_SEQ_COOKIE } from "@/lib/i18n/config";

/**
 * The picture beside the sign-in form (large screens only). Which one is chosen
 * on the server — the one after the last one this browser saw — and this
 * remembers the choice in a cookie so the NEXT visit shows the next picture.
 * With no pictures set up it is a plain coloured panel.
 */
export function LoginArt({ images, index }: { images: string[]; index: number }) {
  useEffect(() => {
    if (images.length === 0) return;
    try {
      document.cookie = `${LOGIN_SEQ_COOKIE}=${index}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      // Cookies blocked: the picture just doesn't rotate.
    }
  }, [images.length, index]);

  return (
    <div
      aria-hidden
      className="relative hidden flex-1 overflow-hidden bg-gradient-to-br from-[#12284c] via-[#1d4e89] to-[#0f5257] lg:block"
    >
      {images.length > 0 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={images[index % images.length]} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
    </div>
  );
}
