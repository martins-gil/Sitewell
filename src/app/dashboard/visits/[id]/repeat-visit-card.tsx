"use client";

import { useState } from "react";
import { RepeatVisitForm } from "@/components/repeat-visit-form";
import { useT } from "@/lib/i18n/client";

/** The visit page's "Repeat this visit" entry: a button that opens the form. */
export function RepeatVisitCard(props: Omit<React.ComponentProps<typeof RepeatVisitForm>, "onClose">) {
  const t = useT();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium hover:underline">
        {t("Repeat or copy this visit →")}
      </button>
    );
  }
  return <RepeatVisitForm {...props} onClose={() => setOpen(false)} />;
}
