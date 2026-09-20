"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import type { HelpArticle } from "@/lib/help/articles";
import { askHelp, type AskResult } from "./actions";

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function ArticleBody({ article }: { article: HelpArticle }) {
  const t = useT();
  return (
    <div className="space-y-2 text-sm">
      <p>{article.answer}</p>
      {article.steps.length > 0 && (
        <ol className="list-decimal space-y-1 pl-5 text-neutral-700 dark:text-neutral-300">
          {article.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      )}
      {article.href && (
        <Link href={article.href} className="inline-block font-medium hover:underline">
          {t("Go there →")}
        </Link>
      )}
    </div>
  );
}

type Answer = { question: string; answer: string | null; related: string[]; usedAi: boolean };

/**
 * The Help screen: an assistant box (ask in your own words) on top, and the
 * step-by-step answers below, grouped by topic and filterable. The assistant
 * answers with AI when the server has a key, otherwise it lists the closest
 * articles — same box either way.
 */
export function HelpCenter({ articles, aiEnabled }: { articles: HelpArticle[]; aiEnabled: boolean }) {
  const t = useT();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState("");

  function handleAsk() {
    setProblem(null);
    const asked = question;
    startTransition(async () => {
      try {
        const result: AskResult = await askHelp(asked);
        if (!result.ok) {
          setProblem(
            result.problem === "EMPTY"
              ? t("Type a question first.")
              : result.problem === "TOO_LONG"
                ? t("That question is too long — please shorten it.")
                : t("Please wait a moment and try again."),
          );
          return;
        }
        setAnswer({ question: asked.trim(), answer: result.answer, related: result.related, usedAi: result.usedAi });
      } catch {
        setProblem(t("Something went wrong. Please try again."));
      }
    });
  }

  const byId = useMemo(() => new Map(articles.map((a) => [a.id, a])), [articles]);

  const terms = normalize(filter).split(/\s+/).filter(Boolean);
  const shown = articles.filter((a) => {
    if (terms.length === 0) return true;
    const haystack = normalize([a.question, a.answer, ...a.steps, a.category].join(" "));
    return terms.every((term) => haystack.includes(term));
  });
  const categories = [...new Set(shown.map((a) => a.category))];

  const related = (answer?.related ?? []).flatMap((id) => {
    const article = byId.get(id);
    return article ? [article] : [];
  });

  return (
    <div className="space-y-8">
      <section className="space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-sm font-medium text-neutral-500">{t("Ask a question")}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="flex flex-wrap gap-2"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={500}
            disabled={pending}
            placeholder={t("e.g. how do I copy a visit to another patient?")}
            aria-label={t("Ask a question")}
            className="min-w-[14rem] flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950"
          />
          <button
            type="submit"
            disabled={pending || !question.trim()}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
          >
            {pending ? t("Thinking…") : t("Ask")}
          </button>
        </form>
        <p className="text-xs text-neutral-500">
          {t("Please don't type patient information — use made-up test data only.")}
        </p>
        {!aiEnabled && (
          <p className="text-xs text-neutral-500">
            {t("The assistant shows the closest answers below. It can write a personal answer once AI is switched on for this app.")}
          </p>
        )}
        {problem && <p className="text-sm text-red-600">{problem}</p>}

        {answer && (
          <div className="space-y-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
            <p className="text-xs text-neutral-500">“{answer.question}”</p>
            {answer.answer ? (
              <>
                <p className="whitespace-pre-wrap text-sm">{answer.answer}</p>
                <p className="text-xs text-neutral-400">
                  {t("Written by an AI assistant from the answers below — it can make mistakes, so check the steps on screen.")}
                </p>
              </>
            ) : related.length > 0 ? (
              <p className="text-sm">{t("These answers are the closest to your question:")}</p>
            ) : (
              <p className="text-sm">
                {t("Nothing matches that. Try other words, or tell us what you were trying to do in Feedback.")}
              </p>
            )}
            {related.map((article) => (
              <div key={article.id} className="rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
                <h3 className="mb-1 text-sm font-medium">{article.question}</h3>
                <ArticleBody article={article} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-neutral-500">{t("Step-by-step answers")}</h2>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("Filter the answers…")}
            aria-label={t("Filter the answers…")}
            className="w-full max-w-xs rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>

        {categories.length === 0 && (
          <p className="text-sm text-neutral-500">{t("No answer contains all of those words.")}</p>
        )}

        {categories.map((category) => (
          <div key={category} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{category}</h3>
            <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              {shown
                .filter((a) => a.category === category)
                .map((article) => (
                  <details key={article.id} className="group px-4 py-3" open={terms.length > 0 && shown.length <= 4}>
                    <summary className="cursor-pointer list-none text-sm font-medium marker:hidden">
                      <span className="mr-1.5 inline-block text-neutral-400 transition-transform group-open:rotate-90">›</span>
                      {article.question}
                    </summary>
                    <div className="mt-2 pl-4">
                      <ArticleBody article={article} />
                    </div>
                  </details>
                ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
