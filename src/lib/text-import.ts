import { z } from "zod";

// Turning pasted protocol text into lists — the built-in (no AI) reader, and the
// checks applied to whatever the AI returns. Pure functions, no server needed.

export type CriteriaDraft = { inclusion: string[]; exclusion: string[] };
export type ChecklistDraftItem = { label: string; detail: string | null };

const MAX_ITEMS = 200;

// Section headings, in the languages the app speaks.
const INCLUSION_HEADING =
  /^(?:\d+(?:\.\d+)*[.)]?\s*)?(?:key\s+|main\s+)?(?:inclusion|inclus[aã]o|inclusi[oó]n|einschluss|inclusione)\b|^(?:\d+[.)]?\s*)?crit[eè]res?\s+d['’]inclusion\b|^(?:\d+[.)]?\s*)?crit[eé]rios?\s+de\s+inclus[aã]o\b/i;
const EXCLUSION_HEADING =
  /^(?:\d+(?:\.\d+)*[.)]?\s*)?(?:key\s+|main\s+)?(?:exclusion|exclus[aã]o|exclusi[oó]n|ausschluss|esclusione)\b|^(?:\d+[.)]?\s*)?crit[eè]res?\s+d['’]exclusion\b|^(?:\d+[.)]?\s*)?crit[eé]rios?\s+de\s+exclus[aã]o\b/i;

// A line that starts a new list item: a bullet, or a number/letter marker.
const MARKER = /^\s*(?:[•●▪◦·*–—-]\s+|\(?\d+(?:\.\d+)*[.)]\s+|\(?[a-zA-Z][.)]\s+|(?:IC|EC|I|E)\s?\d+\s*[:.)-]\s*)/;
// "I3:" / "E2)" style markers carry the group.
const TYPED_MARKER = /^\s*(IC|EC|I|E)\s?\d+\s*[:.)-]\s*/;

function tidy(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/^[•●▪◦·*–—-]\s+/, "")
    .replace(/^\(?\d+(?:\.\d+)*[.)]\s+/, "")
    .replace(/^\(?[a-zA-Z][.)]\s+/, "")
    .replace(/^(?:IC|EC|I|E)\s?\d+\s*[:.)-]\s*/, "")
    // "…; and" / "…;" at the end of a wrapped line
    .replace(/\s*[;,]\s*(?:and|or|e|ou|et|und|oder|y|o)?\s*$/i, "")
    .trim();
}

/**
 * The text's lines as items. A bullet or number starts an item; an unmarked
 * line is a continuation of the item before it only when it looks like wrapped
 * text (it starts in lowercase, or the previous line ends in a hyphen or comma)
 * — otherwise it's an item of its own. Lines ending in a colon are the
 * introduction to a list ("…only if all of the following apply:"), not items.
 */
function toItems(lines: string[]): string[] {
  const items: string[] = [];
  for (const line of lines.map((l) => l.trim()).filter(Boolean)) {
    const previous = items[items.length - 1];
    const continues =
      previous !== undefined &&
      !MARKER.test(line) &&
      (/^[a-zà-ÿ(]/.test(line) || /[-,]$/.test(previous));
    if (continues) items[items.length - 1] = `${previous} ${line}`.replace(/(\w)- (\w)/g, "$1$2");
    else items.push(line);
  }
  return items.filter((item) => !/:$/.test(item));
}

export function parseCriteriaRules(text: string): CriteriaDraft {
  const inclusion: string[] = [];
  const exclusion: string[] = [];
  let current: "I" | "E" | null = null;
  let buffer: string[] = [];

  const flush = () => {
    const target = current === "E" ? exclusion : inclusion;
    for (const raw of toItems(buffer)) {
      // A marker like "E3:" overrides the section it's under.
      const typed = raw.match(TYPED_MARKER)?.[1];
      const cleaned = tidy(raw);
      if (!cleaned) continue;
      (typed && typed.startsWith("E") ? exclusion : typed && typed.startsWith("I") ? inclusion : target).push(cleaned);
    }
    buffer = [];
  };

  for (const line of text.replace(/\r/g, "").split("\n")) {
    const trimmed = line.trim();
    const isShort = trimmed.length <= 70;
    if (isShort && EXCLUSION_HEADING.test(trimmed)) {
      flush();
      current = "E";
      // "Exclusion: age under 18" — keep what follows the colon.
      const rest = trimmed.split(/[:：]/).slice(1).join(":").trim();
      if (rest) buffer.push(rest);
    } else if (isShort && INCLUSION_HEADING.test(trimmed)) {
      flush();
      current = "I";
      const rest = trimmed.split(/[:：]/).slice(1).join(":").trim();
      if (rest) buffer.push(rest);
    } else {
      buffer.push(line);
    }
  }
  flush();

  return { inclusion: dedupe(inclusion).slice(0, MAX_ITEMS), exclusion: dedupe(exclusion).slice(0, MAX_ITEMS) };
}

export function parseChecklistRules(text: string): ChecklistDraftItem[] {
  const items = toItems(text.replace(/\r/g, "").split("\n"))
    // Headings ("Procedures:", "Visit 2") aren't procedures.
    .filter((l) => !/^[^\n]{1,40}:\s*$/.test(l.trim()));

  const result: ChecklistDraftItem[] = [];
  for (const raw of items) {
    const cleaned = raw
      .replace(/\s+/g, " ")
      .replace(/^[•●▪◦·*–—-]\s+/, "")
      .replace(/^\(?\d+(?:\.\d+)*[.)]\s+/, "")
      .replace(/^\(?[a-zA-Z][.)]\s+/, "")
      .replace(/[;,]\s*$/, "")
      .trim();
    if (!cleaned) continue;
    // "Vital signs (temperature, SpO2)" -> label + detail.
    const withDetail = cleaned.match(/^(.*?)\s*\(([^()]{2,})\)\s*$/);
    // "Blood sample - haematology, biochemistry" -> label + detail. Only a dash
    // with spaces around it splits, so "12-lead ECG" stays whole.
    const afterDash = cleaned.match(/^(.{3,60}?)\s+[–—-]\s+(.{2,})$/);
    result.push(
      withDetail && withDetail[1]
        ? { label: withDetail[1].trim(), detail: withDetail[2].trim() }
        : afterDash
          ? { label: afterDash[1].trim(), detail: afterDash[2].trim() }
          : { label: cleaned, detail: null },
    );
  }
  return dedupeBy(result, (i) => i.label.toLowerCase()).slice(0, MAX_ITEMS);
}

function dedupe(list: string[]): string[] {
  return dedupeBy(list, (s) => s.toLowerCase());
}
function dedupeBy<T>(list: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return list.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ---- Validating what the AI sends back ----

const criterionText = z.string().trim().min(1).max(600);

export const criteriaDraftSchema = z.object({
  inclusion: z.array(criterionText).max(MAX_ITEMS),
  exclusion: z.array(criterionText).max(MAX_ITEMS),
});

export const checklistDraftSchema = z.object({
  items: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(250),
        detail: z.string().trim().max(400).nullable().optional(),
      }),
    )
    .max(MAX_ITEMS),
});

/** The JSON object in an AI reply (it may be wrapped in a code fence or prose). */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function cleanCriteria(draft: CriteriaDraft): CriteriaDraft {
  return { inclusion: dedupe(draft.inclusion).slice(0, MAX_ITEMS), exclusion: dedupe(draft.exclusion).slice(0, MAX_ITEMS) };
}

export function cleanChecklist(items: ChecklistDraftItem[]): ChecklistDraftItem[] {
  return dedupeBy(items, (i) => i.label.toLowerCase()).slice(0, MAX_ITEMS);
}
