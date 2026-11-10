import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";

/**
 * No hard-coded colours in app code. A hex colour or a raw Tailwind palette
 * class (`bg-emerald-500`, `text-amber-700`) in a .tsx file bypasses the theme
 * tokens in globals.css, so dark mode and theming drift. Use a semantic token
 * (`bg-success`, `text-warning-on-tint`, `text-destructive-on-tint`, `bg-muted`,
 * `text-chart-4`, `bg-wa-*`, ...). Third-party brand colours live in ONE module,
 * src/components/brand/brand-colors.ts (a .ts file, so it is outside this scan).
 *
 * Read from the TypeScript AST (string, template and JSX text pieces), same as
 * type-floor.test.ts, so a comment that explains the rule is not a use of it.
 * .test files are not app code and are skipped.
 */
const ROOT = resolve(__dirname, "..", "..");
const SRC = join(ROOT, "src");

/** #rrggbb / #rrggbbaa anywhere in a string, or a short #rgb/#rgba inside a Tailwind `[...]` value. */
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6})(?![0-9a-zA-Z])|\[#(?:[0-9a-fA-F]{3,4})\]/g;

const PALETTES =
  "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone";
const UTILITIES =
  "bg|text|border|border-[xytblr]|ring|ring-offset|outline|fill|stroke|from|via|to|divide|decoration|accent|caret|shadow|placeholder";
/** A palette class with a numeric shade, any variant prefix, optional /opacity. */
const PALETTE_CLASS = new RegExp(String.raw`(?<![\w-])(?:${UTILITIES})-(?:${PALETTES})-\d{2,3}(?![\w])`, "g");

/**
 * Files exempt from the scan, each with a reason a reviewer can check. Add an
 * entry only for text that merely LOOKS like a colour.
 */
const ALLOWED = new Map<string, string>([
  ["src/components/data-table14.tsx", "demo rows: order ids such as \"#301456\" are not colours"],
  ["src/components/brand-kit/brand-kit-view.tsx", "an input placeholder that shows the hex format the merchant types"],
]);

export function findHardCodedColours(text: string): string[] {
  return [...text.matchAll(HEX), ...text.matchAll(PALETTE_CLASS)].map((m) => m[0]);
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return f.endsWith(".tsx") && !/\.test\./.test(f) ? [p] : [];
  });
}

function texts(file: string, src: string): string[] {
  const out: string[] = [];
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const walk = (n: ts.Node) => {
    if (ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || ts.isJsxText(n)) {
      out.push(n.text);
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}

describe("no hard-coded colours", () => {
  it("the patterns flag hex colours and palette classes and nothing else", () => {
    expect(findHardCodedColours("bg-[#0A66C2]")).toEqual(["#0A66C2"]);
    expect(findHardCodedColours("color: #f0a821; x #FF000080")).toEqual(["#f0a821", "#FF000080"]);
    expect(findHardCodedColours("bg-[#fff] text-[#abcd]")).toEqual(["[#fff]", "[#abcd]"]);
    expect(findHardCodedColours("dark:text-amber-400 hover:bg-emerald-50/50 border-t-red-500")).toEqual([
      "text-amber-400",
      "bg-emerald-50",
      "border-t-red-500",
    ]);
    // semantic tokens, neutral utilities, anchors, plain numbers and order ids are not colours
    expect(
      findHardCodedColours(
        "bg-success text-warning-on-tint border-destructive/40 bg-white text-black bg-muted-foreground/10 text-chart-4 href=\"#pricing\" #1234 #faq w-[300px] text-red",
      ),
    ).toEqual([]);
  });

  it("no .tsx file under src/ hard-codes a colour", { timeout: 60_000 }, () => {
    // Explicit timeout: a full tree walk, slow under CPU load (same as type-floor.test.ts).
    const hits: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const rel = relative(ROOT, file).replaceAll("\\", "/");
      if (ALLOWED.has(rel)) continue;
      const src = readFileSync(file, "utf8");
      if (!src.includes("#") && !/-\d{2,3}\b/.test(src)) continue;
      for (const t of texts(file, src)) for (const h of findHardCodedColours(t)) hits.push(`${rel}: ${h}`);
    }
    expect(
      hits,
      "use a semantic token from globals.css; third-party brand colours go in src/components/brand/brand-colors.ts",
    ).toEqual([]);
  });
});
