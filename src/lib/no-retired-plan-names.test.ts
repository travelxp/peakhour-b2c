import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";

/**
 * Owner, 2026-10-21: starter and growth are not plans, and D19 says there is
 * no free tier. The scheduler composer told a buyer auto-approve was "on
 * Growth+ plans". Which plan carries a feature is the catalog's to say, so no
 * copy in b2c names a Starter, Growth or Free plan.
 *
 * ★ALL OF src/ AND messages/*.json (review R1, R2): the next occurrence
 * would otherwise land outside the guarded folder, or in the i18n strings.
 *
 * ★READ FROM THE TYPESCRIPT AST: every string, template piece and JSX text
 * run. A regex lexer desyncs on a backtick inside a comment and then skips
 * the very literal it should catch (a first cut of this test did). Comments
 * are not copy and are not read.
 *
 * ★A PLAN NAME, NOT THE WORD, IN ANY CASE (review R2). It matches "Growth+",
 * "Growth Plan", "growth tier", "Starter and Growth plans", "your free plan",
 * "on the Starter", "on Free" at the end of a run. Growth the pillar ("the
 * Growth tab") and free the word ("free shipping", "Start free") carry no
 * plan/tier suffix and pass. The terms page's legal "We may offer free
 * tiers" is the one allowlisted text, by file and by words.
 *
 * ⚠️NOT SEEN: a name split across JSX nodes (`on the <b>Starter</b> plan`),
 * where each node is read alone.
 */
const ROOT = resolve(__dirname, "..", "..");
const SRC = join(ROOT, "src");
const RETIRED =
  /\b(?:starter|growth|free)\s*\+|\b(?:starter|growth|free)(?:\s+(?:and|or|\/)\s+(?:starter|growth|free))*\s+(?:plan|tier)s?\b|\bon\s+(?:the\s+)?starter\b|\bon\s+free\s*(?:[.,;:)!—–-]|$)/i;
/** Legal copy about tiers in general, not a plan name: file → the words allowed. */
const ALLOWED: Record<string, RegExp> = {
  "src/app/(site)/terms/page.tsx": /^We may offer free tiers, trials, or promotional pricing at our discretion\./,
};
/** A cheap prefilter: a file that never says one of the words cannot match. */
const MAY_MATCH = /starter|growth|free/i;

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
    if (ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || ts.isJsxText(n)) {
      out.push(n.text.trim());
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}

const jsonStrings = (v: unknown): string[] =>
  typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(jsonStrings) : [];

const offending = (file: string, t: string) => RETIRED.test(t) && !ALLOWED[file]?.test(t);

describe("no b2c copy names a retired plan", () => {
  it("the pattern catches the plan names in each form and case", () => {
    for (const bad of [
      "on Growth+ plans",
      "growth+ plans",
      "the Starter plan",
      "Upgrade to the Growth Plan",
      "Starter Tier",
      "GROWTH tier",
      "Upgrade from your free plan",
      "Included on the free tier",
      "Starter and Growth plans only",
      "on the\n          Starter",
      "Schedule one at a time on Free.",
      "You're on Free",
    ]) {
      expect(RETIRED.test(bad), bad).toBe(true);
    }
  });

  it("PASS: the pattern leaves pillar and ordinary uses alone", () => {
    for (const ok of ["Posts on the Growth tab", "on Growth campaigns", "free shipping", "Start free", "Growth", "a free task", "free for 14 days"]) {
      expect(RETIRED.test(ok), ok).toBe(false);
    }
  });

  it("the allowlist is the terms page's legal sentence only", () => {
    const terms = "src/app/(site)/terms/page.tsx";
    expect(offending(terms, "We may offer free tiers, trials, or promotional pricing at our discretion. These may change.")).toBe(false);
    expect(offending(terms, "Upgrade from your free plan")).toBe(true);
    expect(offending("src/app/(site)/pricing/page.tsx", "We may offer free tiers, trials, or promotional pricing at our discretion.")).toBe(true);
  });

  it("the extractor sees a literal in each form (string, template, JSX text)", () => {
    const found = texts("x.tsx", "const a = 'on Growth+ plans'; const b = `x ${a} Free plan`; const c = <p>the Starter plan</p>;");
    expect(found.filter((t) => RETIRED.test(t))).toHaveLength(3);
  });

  it("★no i18n message names a Starter, Growth or Free plan", () => {
    const dir = join(ROOT, "messages");
    const hits = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .flatMap((f) => jsonStrings(JSON.parse(readFileSync(join(dir, f), "utf8"))).filter((t) => RETIRED.test(t)).map((t) => `messages/${f}: ${t}`));
    expect(hits).toEqual([]);
  });

  // ★A tree walk: worktrees with a junctioned node_modules run it slowly.
  it(
    "★no source file under src/ names a Starter, Growth or Free plan",
    () => {
      const files = sourceFiles(SRC);
      expect(files.length).toBeGreaterThan(100);
      const hits = files.flatMap((f) => {
        const src = readFileSync(f, "utf8");
        if (!MAY_MATCH.test(src)) return [];
        const rel = relative(ROOT, f).replace(/\\/g, "/");
        return texts(f, src)
          .filter((t) => offending(rel, t))
          .map((t) => `${rel}: ${JSON.stringify(t.slice(0, 100))}`);
      });
      expect(hits).toEqual([]);
    },
    120_000,
  );
});
