"use client";

import { useEffect } from "react";
import { LOGIN_SEQ_COOKIE } from "@/lib/i18n/config";

/**
 * The picture behind the sign-in card, filling the whole page. Which one is chosen on the
 * server — the one after the last one this browser saw — and this remembers the choice in
 * a cookie so the NEXT visit shows the next picture. With no pictures set up it is a plain
 * colour. A light dark veil keeps the card readable whatever the picture.
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
    <div aria-hidden className="fixed inset-0 bg-gradient-to-br from-[#0f3b5c] via-[#1d6a94] to-[#2a8b9a]">
      {images.length > 0 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={images[index % images.length]} alt="" className="h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-neutral-950/30" />
    </div>
  );
}
