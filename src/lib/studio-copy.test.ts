import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { PILLAR_COPY, SUB_COPY } from "@/lib/nav-copy";

/**
 * ★STUDIO SPEAKS PLAIN, AND IN PEAKS. Creative Studio UX spec 9.1 and 9.4, Bible "Words" table, owner rule 2026-11-12 (no money beside a
 * job quote, so no currency symbol or code anywhere a merchant reads Studio).
 *
 * Two scans:
 *   1. every string in `studio-copy.ts` (functions are called with sample values) and Studio's entries in nav-copy.ts;
 *   2. every string a merchant could read in `src/app/(site)/dashboard/studio/**`, `src/app/(site)/share/studio/**` and
 *      `src/components/studio/**`, read from the AST: JSX text, copy attributes (title, aria-label, alt, placeholder, description,
 *      label) and any literal with a space in it that is not a class name or a module path. A sentence typed into a component instead of
 *      studio-copy.ts is judged the same as one in the file.
 */

/** The Bible's avoid-words, with the spelling variants a sentence would use. Whole words, any case. */
const BANNED: Array<[string, RegExp]> = [
  ["draft", /\bdrafts?\b/i],
  ["concept", /\bconcepts?\b/i],
  ["storyboard", /\bstoryboards?\b/i],
  ["queue", /\bqueued?\b|\bqueues\b/i],
  ["backlog", /\bbacklogs?\b/i],
  ["finalize", /\bfinali[sz](?:e|es|ed|ing)\b/i],
  ["upscale", /\bupscal(?:e|es|ed|ing)\b/i],
  ["resolution", /\bresolutions?\b/i],
  ["master", /\bmasters?\b/i],
  ["aspect ratio", /\baspect[\s-]ratios?\b/i],
  ["Council", /\bcouncil\b/i],
  ["Creative Director", /\bcreative director\b/i],
  ["AI Director", /\bai director\b/i],
  ["model", /\bmodels?\b/i],
  ["training", /\btraining\b/i],
  ["A/B", /\ba\/b\b/i],
  ["confidence interval", /\bconfidence interval\b/i],
  ["autopilot", /\bauto-?pilot\b/i],
  ["reserve", /\breserv(?:e|es|ed|ing|ation|ations)\b/i],
  ["capture", /\bcaptur(?:e|es|ed|ing)\b/i],
  ["release", /\breleas(?:e|es|ed|ing)\b/i],
  ["held", /\bheld\b|\bholds?\b|\bholding\b/i],
  ["token", /\btokens?\b/i],
  ["points", /\bpoints?\b/i],
  ["vendors", /\bIMG\.LY\b|\bPolotno\b|\bCE\.SDK\b/i],
  // Vendor and model names are never shown to a merchant (Bible Words table).
  ["model names", /\b(?:flux|imagen|gemini|veo|kling|recraft|ideogram|midjourney|dall-?e|gpt|openai|stability|seedream|fal\.ai|sora|runway|luma)\b/i],
];

/** Rupee, pound, dollar and euro, as a symbol, a code or a word. */
const CURRENCY = /[₹£$€]|\bUSD\b|\bINR\b|\bGBP\b|\bEUR\b|\bCAD\b|\brupees?\b|\bdollars?\b|\bpounds?\b|\beuros?\b/i;

/** The one allowed use of "drafts" is the later "Scheduled drafts" row (CS-15). */
const ALLOWED = /\bscheduled drafts\b/gi;

function problemsIn(text: string): string[] {
  const t = text.replace(ALLOWED, "");
  const out: string[] = [];
  for (const [name, re] of BANNED) if (re.test(t)) out.push(`avoid-word "${name}"`);
  if (CURRENCY.test(text)) out.push("currency symbol or code");
  return out;
}

/** Every string in a copy object; a function is called with sample arguments. */
function stringsOf(v: unknown, path = "copy"): Array<[string, string]> {
  if (typeof v === "string") return [[path, v]];
  if (typeof v === "function") {
    const out = (v as (...a: string[]) => unknown)("Sample", "Other");
    return typeof out === "string" ? [[`${path}()`, out]] : [];
  }
  if (v && typeof v === "object") return Object.entries(v).flatMap(([k, x]) => stringsOf(x, `${path}.${k}`));
  return [];
}

describe("the guard itself catches what it should", () => {
  it("flags a currency symbol, a code and an avoid-word, and lets plain Peaks copy through", () => {
    expect(problemsIn("Uses 200 Peaks")).toEqual([]);
    const bad = ["₹200", "£5", "$5", "€5", "Costs 5 USD", "Finalize it", "Upscale", "your model", "Autopilot", "token", "A/B test", "a draft"];
    for (const b of bad) expect(problemsIn(b), b).not.toEqual([]);
    expect(problemsIn("Scheduled drafts")).toEqual([]);
  });
});

describe("studio-copy.ts", () => {
  const all = stringsOf(STUDIO_COPY);
  it("has strings to judge", () => expect(all.length).toBeGreaterThan(40));
  for (const [path, text] of all) {
    it(`${path} is plain and in Peaks`, () => {
      expect(problemsIn(text), text).toEqual([]);
    });
  }
  it("Studio's nav entries are plain too", () => {
    const sub = Object.entries(SUB_COPY)
      .filter(([h]) => h.startsWith("/dashboard/studio"))
      .map(([, c]) => c);
    const entries = [PILLAR_COPY["/dashboard/studio"], ...sub];
    expect(entries.length).toBe(5);
    for (const e of entries) expect(problemsIn(`${e.label}. ${e.description}`)).toEqual([]);
  });
});

// -- scan 2: the Studio screens' own strings ---------------------------------

const SRC = resolve(__dirname, "..");
const ROOTS = ["app/(site)/dashboard/studio", "app/(site)/share/studio", "components/studio"].map((r) => join(SRC, r));
const COPY_ATTRS = new Set(["title", "aria-label", "alt", "placeholder", "description", "label"]);

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return /\.tsx?$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });

interface Found {
  text: string;
  /** A sentence a merchant reads: judged for avoid-words. Currency is judged for every literal either way. */
  copy: boolean;
}

function literalsIn(source: string): Found[] {
  const sf = ts.createSourceFile("x.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Found[] = [];
  const inClass = (n: ts.Node): boolean => {
    for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
      if (ts.isJsxAttribute(p)) return p.name.getText() === "className";
      if (ts.isCallExpression(p) && ["cn", "cva", "clsx"].includes(p.expression.getText())) return true;
      if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return true;
    }
    return false;
  };
  const attrName = (n: ts.Node): string | undefined => {
    for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
      if (ts.isJsxAttribute(p)) return p.name.getText();
      if (ts.isJsxElement(p) || ts.isJsxSelfClosingElement(p)) return undefined;
    }
    return undefined;
  };
  const visit = (n: ts.Node) => {
    if (ts.isJsxText(n)) {
      const t = n.text.replace(/\s+/g, " ").trim();
      if (t) out.push({ text: t, copy: true });
    } else if (
      ts.isStringLiteral(n) ||
      ts.isNoSubstitutionTemplateLiteral(n) ||
      ts.isTemplateHead(n) ||
      ts.isTemplateMiddle(n) ||
      ts.isTemplateTail(n)
    ) {
      if (!inClass(n)) {
        const text = n.text;
        const a = attrName(n);
        const isCopyAttr = a !== undefined && COPY_ATTRS.has(a);
        out.push({ text, copy: isCopyAttr || (/\s/.test(text.trim()) && !text.startsWith("/")) });
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

describe("Studio screens and components", () => {
  const list = ROOTS.flatMap(files);
  it("scans the studio folders", () => expect(list.length).toBeGreaterThan(8));
  it("the scanner reads a sentence typed into a component", () => {
    const found = literalsIn('export const X = () => <p aria-label="Costs $5">Make a draft</p>;');
    expect(found.map((f) => problemsIn(f.text).length > 0)).toEqual([true, true]);
  });
  for (const file of list) {
    it(`${relative(SRC, file).replace(/\\/g, "/")} has no currency and no avoid-word`, () => {
      const bad = literalsIn(readFileSync(file, "utf8")).flatMap((f) => {
        const p = f.copy ? problemsIn(f.text) : CURRENCY.test(f.text) ? ["currency symbol or code"] : [];
        return p.map((x) => `${x} in "${f.text}"`);
      });
      expect(bad).toEqual([]);
    });
  }
});
