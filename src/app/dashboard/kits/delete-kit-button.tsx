"use client";

import { useTransition } from "react";
import { deleteKit } from "./actions";

export function DeleteKitButton({ kitId }: { kitId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => deleteKit(kitId))}
      className="text-xs text-red-700 hover:underline disabled:opacity-60 dark:text-red-400"
    >
      Remove
    </button>
  );
}
