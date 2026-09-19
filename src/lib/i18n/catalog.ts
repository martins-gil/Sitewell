import data from "./catalog.json";

// Every user-facing text, by its English wording: [fr, de, it, es, pt].
// English is the key itself. The rows live in catalog.json (one per line);
// `node scripts/check-i18n.mjs` checks that every text used in the code has a
// complete row and that placeholders ({0}) and plural bars (|) line up.
// Portuguese is European Portuguese (the site's own forms use it).
export const CATALOG = data as unknown as Record<string, [string, string, string, string, string]>;
