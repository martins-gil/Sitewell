"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDate, humanizeEnum } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import type { SearchHit, SearchResults } from "@/lib/search";

type Answer = { query: string; results: SearchResults };

/**
 * The search box across the top of the app: type a patient code, a visit, a
 * study… — several terms narrow it down ("RCN-101-0009, week 4") — and jump
 * straight to a result, or press Enter for the full list. Ctrl/⌘+K focuses it.
 */
export function GlobalSearch() {
  const t = useT();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const trimmed = query.trim();

  // Ask the server a moment after typing stops. Nothing is set synchronously
  // here — the answer arrives in the callback — and a newer keystroke cancels
  // the older request.
  useEffect(() => {
    if (!trimmed) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (!res.ok) return;
        setAnswer({ query: trimmed, results: (await res.json()) as SearchResults });
      } catch {
        // Aborted or offline: keep whatever was showing.
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = trimmed && answer ? answer.results : null;
  const loading = trimmed !== "" && answer?.query !== trimmed;

  const groups = useMemo(
    () =>
      results
        ? [
            { key: "patients", title: t("Patients"), hits: results.patients },
            { key: "visits", title: t("Visits"), hits: results.visits },
            { key: "studies", title: t("Studies"), hits: results.studies },
            { key: "documents", title: t("Documents"), hits: results.documents },
            { key: "kits", title: t("Kits Inventory"), hits: results.kits },
          ].filter((g) => g.hits.length > 0)
        : [],
    [results, t],
  );
  const flat = groups.flatMap((g) => g.hits);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "Enter" && trimmed) {
      e.preventDefault();
      go(active >= 0 && flat[active] ? flat[active].href : `/dashboard/search?q=${encodeURIComponent(trimmed)}`);
    }
  }

  function detailOf(hit: SearchHit) {
    return [
      hit.kindLabel ? t(hit.kindLabel) : null,
      hit.detail,
      hit.status ? t(humanizeEnum(hit.status)) : null,
      hit.date ? formatDate(hit.date, t.locale) : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  let index = -1;
  return (
    <div
      className="relative w-full max-w-xl"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={t("Search… e.g. RCN-101-0009, week 4")}
        aria-label={t("Search")}
        className="w-full rounded-full border border-transparent bg-neutral-100 px-4 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-300 focus:bg-white dark:bg-neutral-900 dark:focus:border-neutral-700 dark:focus:bg-neutral-950"
      />

      {open && trimmed && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[70vh] overflow-y-auto rounded-md border border-neutral-200 bg-white text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          {loading && flat.length === 0 && <p className="px-3 py-2 text-neutral-500">{t("Searching…")}</p>}
          {!loading && flat.length === 0 && (
            <p className="px-3 py-2 text-neutral-500">{t("No results for “{0}”.", [trimmed])}</p>
          )}
          {groups.map((group) => (
            <div key={group.key}>
              <p className="bg-neutral-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:bg-neutral-950">
                {group.title}
              </p>
              <ul>
                {group.hits.map((hit) => {
                  index += 1;
                  const isActive = index === active;
                  return (
                    <li key={hit.id}>
                      <Link
                        href={hit.href}
                        onClick={() => setOpen(false)}
                        className={`block px-3 py-1.5 ${
                          isActive ? "bg-neutral-100 dark:bg-neutral-800" : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
                        }`}
                      >
                        <span className="font-medium">{hit.title}</span>
                        <span className="ml-2 text-xs text-neutral-500">{detailOf(hit)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <Link
            href={`/dashboard/search?q=${encodeURIComponent(trimmed)}`}
            onClick={() => setOpen(false)}
            className="block border-t border-neutral-200 px-3 py-2 text-center text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {t("See all results →")}
          </Link>
        </div>
      )}
    </div>
  );
}
