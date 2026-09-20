"use server";

import { requireTenantContext } from "@/lib/db-context";
import { aiConfigured, askClaude } from "@/lib/ai";
import { tooBusy } from "@/lib/throttle";
import { helpArticles, type HelpArticle } from "@/lib/help/articles";
import { LOCALE_NAMES } from "@/lib/i18n/config";
import { getT } from "@/lib/i18n/server";
import { makeT } from "@/lib/i18n/translate";

// The Help assistant. Results are returned, not thrown (a thrown server-action
// error is masked in production). With an Anthropic key it answers in the
// user's own words from the Help articles; without one it just points at the
// closest articles, so the page is useful either way.
//
// Only the typed question is sent to the AI — never patient data. The screen
// tells people not to type any, and the question is capped in length.

const MAX_QUESTION = 500;
const HOW_MANY_RELATED = 3;

export type AskResult =
  | { ok: true; answer: string | null; related: string[]; usedAi: boolean }
  | { ok: false; problem: "EMPTY" | "TOO_LONG" | "BUSY" };

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Words too common to say what a question is about.
const FILLER = new Set(["how", "the", "and", "for", "can", "does", "what", "where", "with", "one", "you", "are", "why", "not", "this", "that", "from", "have", "want", "need", "when", "there", "some", "into", "than", "they", "them", "make", "get", "add", "does"]);

/** "visits" → "visit": enough to match a plural against a singular. */
const stem = (word: string) => (word.length > 4 && word.endsWith("s") ? word.slice(0, -1) : word);

type Searchable = { id: string; title: string; body: string };

/**
 * The articles that best match the question's words, best first (the fallback
 * when AI is off, and the AI's safety net). Rare words count for more than
 * ones every article uses ("patient", "visit"), so "copy a visit to another
 * patient" finds the repeat-visit article rather than any article about visits.
 */
function closestArticles(question: string, docs: Searchable[]): string[] {
  const words = [
    ...new Set(
      normalize(question)
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 3 && !FILLER.has(w))
        .map(stem),
    ),
  ];
  if (words.length === 0) return [];
  const prepared = docs.map((d) => ({ id: d.id, title: normalize(d.title), body: normalize(d.body) }));
  return prepared
    .map((doc) => {
      let score = 0;
      for (const w of words) {
        const inTitle = doc.title.includes(w);
        const inBody = doc.body.includes(w);
        if (!inTitle && !inBody) continue;
        const spread = prepared.filter((d) => d.title.includes(w) || d.body.includes(w)).length;
        const weight = Math.log(1 + prepared.length / spread);
        score += weight * ((inTitle ? 3 : 0) + (inBody ? 1 : 0));
      }
      return { id: doc.id, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, HOW_MANY_RELATED)
    .map((entry) => entry.id);
}

function knowledgeBase(articles: HelpArticle[]): string {
  return articles
    .map((a) => {
      const steps = a.steps.map((step, i) => `${i + 1}. ${step}`).join("\n");
      return `[${a.id}] ${a.question}\n${a.answer}${steps ? `\n${steps}` : ""}`;
    })
    .join("\n\n");
}

export async function askHelp(question: string): Promise<AskResult> {
  const ctx = await requireTenantContext();
  const trimmed = question.trim();
  if (!trimmed) return { ok: false, problem: "EMPTY" };
  if (trimmed.length > MAX_QUESTION) return { ok: false, problem: "TOO_LONG" };

  const t = await getT();
  const articles = helpArticles(t);
  // Match against the English text as well, so someone asking in English while the app is in another language is still understood.
  const english = helpArticles(makeT("en", {}));
  const fallback = closestArticles(
    trimmed,
    articles.map((a, i) => ({
      id: a.id,
      title: `${a.question} ${english[i].question}`,
      body: [a.answer, ...a.steps, english[i].answer, ...english[i].steps, english[i].keywords ?? ""].join(" "),
    })),
  );

  if (!aiConfigured()) return { ok: true, answer: null, related: fallback, usedAi: false };
  if (tooBusy(`help:${ctx.userId}`, 10)) return { ok: false, problem: "BUSY" };

  const ids = new Set(articles.map((a) => a.id));
  const result = await askClaude({
    cacheSystem: true,
    maxTokens: 1200,
    system: `You are the help assistant inside SiteWell-ct, a web app clinical research coordinators (CRCs) use at a clinical-trial site to manage studies, patients, visits, visit checklists, documents and kits. The person asking may be new to the app and to computers: be patient, concrete and brief.

The app's menu is: Overview, Patients, Studies, Visits Schedule, Kits Inventory, Documents, Help, Feedback, Settings. There is a search bar at the top of every page.

Answer ONLY from the help articles below, which describe the app in ${LOCALE_NAMES[t.locale]} exactly as it appears on screen. Use the button and menu names exactly as written there.
- Give numbered steps when the answer is a procedure. Two to six short steps is ideal. Plain text only: no markdown symbols, no headings, no bold.
- Reply in the language of the question (${LOCALE_NAMES[t.locale]} if it is unclear).
- If the articles do not cover the question, say so plainly and suggest the Feedback page or asking the organisation's admin. Never invent buttons, screens or features, and never give medical, regulatory or protocol advice.
- This is a test environment: if the question contains what looks like real patient information (names, birth dates, ID numbers), do not repeat it, and remind the person to use only made-up test data.
- Finish with one last line in exactly this form, using article ids from the list (or nothing after the colon): RELATED: id1, id2

HELP ARTICLES

${knowledgeBase(articles)}`,
    user: trimmed,
  });

  if (!result.ok) return { ok: true, answer: null, related: fallback, usedAi: false };

  // The last line names the related articles; keep it out of the answer text.
  const lines = result.text.split("\n");
  const last = lines.length - 1;
  let related: string[] = [];
  if (/^\s*RELATED:/i.test(lines[last] ?? "")) {
    related = lines[last].replace(/^\s*RELATED:/i, "").split(/[,\s]+/).map((id) => id.replace(/[[\]]/g, "")).filter((id) => ids.has(id));
    lines.pop();
  }
  const answer = lines.join("\n").trim();
  return { ok: true, answer: answer || null, related: related.length > 0 ? related.slice(0, HOW_MANY_RELATED) : fallback, usedAi: Boolean(answer) };
}
