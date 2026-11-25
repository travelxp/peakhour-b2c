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
const BAD = [/\bAI[\s-]+(?:\$\{\}\s*)?credits?\b/i, /\d[\d,]*\s+credits?\b/i, /\bcredits (?:left|renew|run out)\b/i, /\b(?:your|more|buy|add|top ?up|extra) credits\b/i, /\bcredit balance\b/i, /\b(?:uses|costs|the) credits\b/i, /\bcredits \(Peaks\)/i];
const EXEMPT = [/^src\/content\/seo\/competitors\//];

/**
 * Held for the owner: published pages whose copy is under a CMS approval (src/lib/seo/approvals.ts). Changing a word
 * moves the page's contentHash and unpublishes it until a new approval row lands, and that sign-off is the owner's, not
 * a code change's. Each still says "AI credits" until the owner re-approves the page with the new word; then delete the
 * entry (the last test fails while an entry no longer matches).
 */
export const HELD: Record<string, string[]> = {
  "src/content/pages/commerce.ts": ["Each AI answer uses Peaks, the AI credits in Peakhour Suite. See the pricing page for the monthly allowance."],
  "src/content/pages/shopify.features.ai.seo.ts": ["AI credits (Peaks) and the Suite plan. The pricing page shows what the plan includes."],
  "src/content/pages/feature-peakhour-summit.ts": ["The credits a question to Peakhour Summit is priced in."],
  "src/content/pages/shopify.features.ai.shopping.assistant.ts": [
    "Does the chat use AI credits?",
    "Yes. Each AI answer uses credits (Peaks), and stores that have not paid get a smaller daily allowance. The pricing page shows what the plan includes.",
  ],
  "src/lib/seo/pages.ts": [
    "Peaks: the AI credits behind every Peakhour feature",
    "Peaks are the AI credits behind every Peakhour feature. Every plan includes a monthly allowance, and purchased Peaks never expire. Top up any time.",
  ],
  "src/lib/seo/capabilities.ts": [
    "The AI call uses credits; unpaid stores get a smaller daily allowance.",
    "Needs AI credits and the Suite plan.",
    "A draft costs credits.",
  ],
};

export function creditWording(text: string): boolean {
  if (/^[a-z0-9-]+$/.test(text)) return false; // a slug or key (an entry id), not copy
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
    // A template that splits the phrase around an expression ("AI ${x} credits") is read joined, the expression as ${}.
    if (ts.isTemplateExpression(n)) out.push(n.head.text + n.templateSpans.map((sp) => "${}" + sp.literal.text).join(""));
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
    expect(creditWording("AI-credits left")).toBe(true);
    expect(creditWording("ai-credits")).toBe(false);
    expect(creditWording("The AI call uses credits;")).toBe(true);
    expect(creditWording("Each answer uses credits (Peaks)")).toBe(true);
    expect(creditWording("Includes 5,000 credits a month")).toBe(true);
    expect(creditWording("Your credits renew monthly")).toBe(true);
    expect(creditWording("Credits left: 3")).toBe(true);
    expect(creditWording("AI ${}  credits")).toBe(true);
    expect(creditWording("Includes 5,000 Peaks a month")).toBe(false);
    expect(creditWording("Uses your Peaks.")).toBe(false);
    expect(creditWording("CREDITS_EXHAUSTED")).toBe(false);
    expect(creditWording("No credit card required")).toBe(false);
  });

  it("no string in src says AI credits", () => {
    const hits: string[] = [];
    for (const file of sourceFiles(join(ROOT, "src"))) {
      const rel = relative(ROOT, file).split("\\").join("/");
      if (EXEMPT.some((re) => re.test(rel))) continue;
      for (const t of texts(file, readFileSync(file, "utf8"))) {
        if (creditWording(t) && !HELD[rel]?.includes(t)) hits.push(`${rel}: "${t.replace(/\s+/g, " ").slice(0, 80)}"`);
      }
    }
    expect(hits, 'say "Peaks": formatPeaks in src/lib/pricing.ts returns only the digits, so write the word "Peaks" after it; the owner retired "AI credits" on 2026-11-25').toEqual([]);
  }, 60_000);

  it("every HELD string is still in its file, so the list cannot rot", () => {
    for (const [rel, held] of Object.entries(HELD)) {
      const found = texts(rel, readFileSync(join(ROOT, rel), "utf8"));
      for (const h of held) expect(found, `${rel} no longer has "${h}"; drop it from HELD`).toContain(h);
    }
  });
});
