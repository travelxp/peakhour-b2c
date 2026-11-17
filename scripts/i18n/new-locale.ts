/**
 * Write an empty message skeleton for a new language.
 *
 *   npx tsx scripts/i18n/new-locale.ts fr-CA
 *
 * Writes messages/<locale>.json with exactly en.json's keys and "" for every value, and prints the number of
 * strings to translate. It refuses an unknown locale (the code must be in LOCALES, lib/seo/types.ts), "en",
 * and a file that already exists (it never overwrites a translation). The skeleton is NOT to be committed
 * until a native reviewer has the strings (docs/seo/LOCALIZATION.md): the key-parity test passes on it, but
 * the published-locale test fails on empty values, so a half-written language cannot be published.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { LOCALES } from "../../src/lib/seo/types";

type Tree = { [key: string]: Tree | string };

/** en.json's shape with every string replaced by "". */
export function skeleton(en: Tree): Tree {
  const out: Tree = {};
  for (const [k, v] of Object.entries(en)) out[k] = typeof v === "string" ? "" : skeleton(v);
  return out;
}

export function countStrings(tree: Tree): number {
  return Object.values(tree).reduce<number>((n, v) => n + (typeof v === "string" ? 1 : countStrings(v)), 0);
}

function main() {
  const locale = process.argv[2];
  const dir = resolve(__dirname, "../../messages");
  if (!locale) throw new Error(`Usage: npx tsx scripts/i18n/new-locale.ts <locale>   (one of ${LOCALES.join(", ")})`);
  if (locale === "en") throw new Error("en.json is the source of truth; there is no skeleton for it.");
  if (!(LOCALES as readonly string[]).includes(locale)) {
    throw new Error(`"${locale}" is not in LOCALES (src/lib/seo/types.ts). Declare it there first: ${LOCALES.join(", ")}`);
  }
  const target = join(dir, `${locale}.json`);
  if (existsSync(target)) throw new Error(`${target} already exists; this script never overwrites a translation.`);
  const sk = skeleton(JSON.parse(readFileSync(join(dir, "en.json"), "utf8")) as Tree);
  writeFileSync(target, `${JSON.stringify(sk, null, 2)}\n`, "utf8");
  console.log(`Wrote ${target} with ${countStrings(sk)} empty strings. Do not commit it until a native reviewer has translated and approved them.`);
}

if (process.argv[1]?.split("\\").join("/").endsWith("scripts/i18n/new-locale.ts")) main();
