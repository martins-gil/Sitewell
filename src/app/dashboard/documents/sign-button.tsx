"use client";

import { useState, useTransition } from "react";
import { signDocument } from "./actions";

export function SignButton({ documentId }: { documentId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="text-right">
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              await signDocument(documentId);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to sign.");
            }
          })
        }
        className="text-xs text-neutral-600 hover:underline disabled:opacity-60 dark:text-neutral-400"
      >
        Sign
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
