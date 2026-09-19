// Checks the translations: every English text passed to t("…") in src/ (plus the
// few that reach t() dynamically — see EXTRA_KEYS_FILE) must have a row in
// src/lib/i18n/catalog.json with all five translations, and every row must
// still be used.
//
//   node scripts/check-i18n.mjs          report problems (exit 1 if any)
//   node scripts/check-i18n.mjs --list   print every key in use, as JSON
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CATALOG_FILE = path.join(ROOT, "src/lib/i18n/catalog.json");
const EXTRA_KEYS_FILE = path.join(ROOT, "src/lib/i18n/extra-keys.ts");
const LABEL_FILES = ["src/lib/preferences.ts", "src/app/dashboard/layout.tsx"];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

const used = new Set();
for (const file of walk(path.join(ROOT, "src"))) {
  const text = fs.readFileSync(file, "utf8");
  for (const m of text.matchAll(/\bt\(\s*("(?:[^"\\\n]|\\.)*")/g)) used.add(JSON.parse(m[1]));
}
for (const rel of LABEL_FILES) {
  const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
  for (const m of text.matchAll(/\blabel:\s*("(?:[^"\\\n]|\\.)*")/g)) used.add(JSON.parse(m[1]));
}
if (fs.existsSync(EXTRA_KEYS_FILE)) {
  for (const m of fs.readFileSync(EXTRA_KEYS_FILE, "utf8").matchAll(/^\s*("(?:[^"\\\n]|\\.)*"),?\s*$/gm)) {
    used.add(JSON.parse(m[1]));
  }
}

if (process.argv.includes("--list")) {
  console.log(JSON.stringify([...used].sort(), null, 1));
  process.exit(0);
}

const catalog = fs.existsSync(CATALOG_FILE) ? JSON.parse(fs.readFileSync(CATALOG_FILE, "utf8")) : {};
const problems = [];
for (const key of used) {
  const row = catalog[key];
  if (!row) problems.push(`missing:   ${key}`);
  else if (!Array.isArray(row) || row.length !== 5 || row.some((s) => typeof s !== "string" || !s.trim())) {
    problems.push(`incomplete: ${key}`);
  } else {
    // Placeholders and plural bars must match the English text in every language.
    const wanted = (key.match(/\{\d+\}/g) ?? []).sort().join(",");
    const plural = key.includes("|");
    for (const s of row) {
      const got = (s.match(/\{\d+\}/g) ?? []).sort().join(",");
      if (got !== wanted) problems.push(`placeholders differ: ${key}  ->  ${s}`);
      if (s.includes("|") !== plural) problems.push(`plural bar differs: ${key}  ->  ${s}`);
    }
  }
}
for (const key of Object.keys(catalog)) if (!used.has(key)) problems.push(`unused:    ${key}`);

if (problems.length) {
  console.log(problems.join("\n"));
  console.log(`\n${problems.length} problem(s).`);
  process.exit(1);
}
console.log(`i18n OK — ${used.size} texts x 5 languages.`);
