"use server";

import { requireTenantContext } from "@/lib/db-context";
import { aiConfigured, askClaude } from "@/lib/ai";
import { tooBusy } from "@/lib/throttle";
import {
  checklistDraftSchema,
  cleanChecklist,
  cleanCriteria,
  criteriaDraftSchema,
  extractJson,
  parseChecklistRules,
  parseCriteriaRules,
  type ChecklistDraftItem,
  type CriteriaDraft,
} from "@/lib/text-import";

// Reading pasted protocol text into lists. Results are returned (not thrown):
// a thrown server-action error is masked in production, so the form couldn't
// say what went wrong. `usedAi` tells the screen which reader produced the
// draft; `note` says why the AI wasn't used when it was expected to be.

const MAX_TEXT = 30_000;

export type ReadNote = "refused" | "failed" | null;
export type ReadProblem = "EMPTY" | "TOO_LONG" | "BUSY";

const CRITERIA_SYSTEM = `You extract the eligibility criteria from clinical-trial protocol text. The text may be in any language and may have been copied from a PDF, so lines can be wrapped or hyphenated.

Reply with ONLY a JSON object: {"inclusion": string[], "exclusion": string[]}

Rules:
- One string per criterion, in the original language and wording. Do not translate, summarise, reword or invent anything.
- Remove numbering, bullets and markers such as "I3:" or "5.1"; join lines that were only wrapped; fix words broken by a hyphen at the end of a line.
- Text under an inclusion heading goes in "inclusion"; text under an exclusion heading goes in "exclusion". A marker such as I1 / E3 also tells you the group.
- Skip headings, introductory sentences ("Participants are eligible if..."), page numbers, headers and footers.
- Split a bullet only when it clearly contains several separate requirements; otherwise keep it whole.
- If a criterion's group is really unclear, put it in "inclusion".`;

const CHECKLIST_SYSTEM = `You turn pasted text into the list of procedures / assessments performed at a clinical-trial visit. The text may be in any language and may have been copied from a protocol or a schedule of assessments.

Reply with ONLY a JSON object: {"items": [{"label": string, "detail": string | null}]}

Rules:
- One item per procedure, in the original order and language. "label" is the procedure's name as written (short); "detail" is extra information the text gives about it (for example what is in parentheses, or after a dash), otherwise null.
- Remove numbering and bullets; join lines that were only wrapped.
- Skip headings, visit names, page numbers, headers and footers. Do not invent, merge, reword or translate anything.`;

export type ReadCriteriaResult =
  | { ok: true; draft: CriteriaDraft; usedAi: boolean; note: ReadNote }
  | { ok: false; problem: ReadProblem };

export async function readCriteriaText(text: string): Promise<ReadCriteriaResult> {
  const ctx = await requireTenantContext();
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, problem: "EMPTY" };
  if (trimmed.length > MAX_TEXT) return { ok: false, problem: "TOO_LONG" };

  let note: ReadNote = null;
  if (aiConfigured()) {
    if (tooBusy(ctx.userId)) return { ok: false, problem: "BUSY" };
    const answer = await askClaude({ system: CRITERIA_SYSTEM, user: trimmed });
    if (answer.ok) {
      const parsed = criteriaDraftSchema.safeParse(extractJson(answer.text));
      if (parsed.success && parsed.data.inclusion.length + parsed.data.exclusion.length > 0) {
        return { ok: true, draft: cleanCriteria(parsed.data), usedAi: true, note: null };
      }
      note = "failed";
    } else if (answer.reason === "refused" || answer.reason === "failed") {
      note = answer.reason;
    }
  }
  return { ok: true, draft: parseCriteriaRules(trimmed), usedAi: false, note };
}

export type ReadChecklistResult =
  | { ok: true; items: ChecklistDraftItem[]; usedAi: boolean; note: ReadNote }
  | { ok: false; problem: ReadProblem };

export async function readChecklistText(text: string): Promise<ReadChecklistResult> {
  const ctx = await requireTenantContext();
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, problem: "EMPTY" };
  if (trimmed.length > MAX_TEXT) return { ok: false, problem: "TOO_LONG" };

  let note: ReadNote = null;
  if (aiConfigured()) {
    if (tooBusy(ctx.userId)) return { ok: false, problem: "BUSY" };
    const answer = await askClaude({ system: CHECKLIST_SYSTEM, user: trimmed });
    if (answer.ok) {
      const parsed = checklistDraftSchema.safeParse(extractJson(answer.text));
      if (parsed.success && parsed.data.items.length > 0) {
        return {
          ok: true,
          items: cleanChecklist(parsed.data.items.map((i) => ({ label: i.label, detail: i.detail?.trim() || null }))),
          usedAi: true,
          note: null,
        };
      }
      note = "failed";
    } else if (answer.reason === "refused" || answer.reason === "failed") {
      note = answer.reason;
    }
  }
  return { ok: true, items: parseChecklistRules(trimmed), usedAi: false, note };
}
