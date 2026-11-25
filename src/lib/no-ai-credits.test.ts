import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";

/**
 * Owner, 2026-11-25: "AI credits should never be used. Peaks balance is correct."
 * Every string a merchant, shopper or team member can read says Peaks. This reads
 * string, template and JSX text pieces from the TypeScript AST (so a comment or an
 * identifier like `CREDITS_EXHAUSTED` never matches) across all of src.
 *
 * The one exception is another vendor's own plan wording on a competitor page
 * (src/content/seo/competitors): it quotes what that vendor calls its unit.
 */
const ROOT = resolve(__dirname, "..", "..");
const BAD = [/\bAI credits?\b/i, /\b(?:your|more|buy|add|top ?up|extra) credits\b/i, /\bcredit balance\b/i];
const EXEMPT = [/^src\/content\/seo\/competitors\//];

/**
 * Held for the owner: published pages whose copy is under a CMS approval (src/lib/seo/approvals.ts). Changing a word
 * moves the page's contentHash and unpublishes it until a new approval row lands, and that sign-off is the owner's, not
 * a code change's. Each still says "AI credits" until the owner re-approves the page with the new word; then delete the
 * entry (the last test fails while an entry no longer matches).
 */
export const HELD: Record<string, string> = {
  "src/content/pages/commerce.ts": "page commerce (FAQ)",
  "src/content/pages/shopify.features.ai.seo.ts": "page shopify.features.ai.seo (FAQ)",
  "src/content/pages/shopify.features.ai.shopping.assistant.ts": "page shopify.features.ai.shopping.assistant (FAQ)",
  "src/lib/seo/pages.ts": "page peaks (title and description)",
  "src/lib/seo/capabilities.ts": "capability limitation read by the Shopify feature pages",
};

export function creditWording(text: string): boolean {
  return BAD.some((re) => re.test(text));
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
}

function texts(file: string, src: string): string[] {
  const out: string[] = [];
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, kind);
  const walk = (n: ts.Node) => {
    if (ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || ts.isJsxText(n)) out.push(n.text);
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}

describe("the unit is Peaks, never AI credits", () => {
  it("the pattern flags the old wording and not Peaks, an api code or a credit card", () => {
    expect(creditWording("Uses your AI credits.")).toBe(true);
    expect(creditWording("AI credits (Peaks) a month")).toBe(true);
    expect(creditWording("Your credit balance, top-ups")).toBe(true);
    expect(creditWording("Add credits to continue")).toBe(true);
    expect(creditWording("Buy credits")).toBe(true);
    expect(creditWording("Uses your Peaks.")).toBe(false);
    expect(creditWording("CREDITS_EXHAUSTED")).toBe(false);
    expect(creditWording("No credit card required")).toBe(false);
  });

  it("no string in src says AI credits", () => {
    const hits: string[] = [];
    for (const file of sourceFiles(join(ROOT, "src"))) {
      const rel = relative(ROOT, file).split("\\").join("/");
      if (EXEMPT.some((re) => re.test(rel)) || rel in HELD) continue;
      for (const t of texts(file, readFileSync(file, "utf8"))) {
        if (creditWording(t)) hits.push(`${rel}: "${t.replace(/\s+/g, " ").slice(0, 80)}"`);
      }
    }
    expect(hits, 'say "Peaks" (see src/lib/peaks.ts formatPeaks); the owner retired "AI credits" on 2026-11-25').toEqual([]);
  }, 60_000);

  it("every HELD entry still says AI credits, so the list cannot rot", () => {
    for (const rel of Object.keys(HELD)) {
      expect(texts(rel, readFileSync(join(ROOT, rel), "utf8")).some(creditWording), `${rel} is clean now; drop it from HELD`).toBe(true);
    }
  });
});
