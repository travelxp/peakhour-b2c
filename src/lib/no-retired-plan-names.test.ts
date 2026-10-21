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
 * ★THE WHOLE OF src/, not one folder (review R1): the next occurrence would
 * otherwise land outside the guarded directory.
 *
 * ★READ FROM THE TYPESCRIPT AST: every string, template piece and JSX text
 * run. A regex lexer desyncs on a backtick inside a comment and then skips
 * the very literal it should catch (a first cut of this test did). Comments
 * are not copy and are not read.
 *
 * ★THE PATTERN IS A PLAN NAME, NOT THE WORD (review R1). Growth is a live
 * pillar ("the Growth tab") and free is an English word ("free shipping",
 * the terms page's "free tiers"), so it matches "Starter+", "Growth plan",
 * "growth tier", "Free plan", "on the Starter", "on Free." in any case for
 * starter/growth, and any run of whitespace (JSX text wraps). "Free" counts
 * only capitalised, as a plan name.
 */
const SRC = resolve(__dirname, "..");
const RETIRED =
  /\b(?:[Ss][Tt][Aa][Rr][Tt][Ee][Rr]|[Gg][Rr][Oo][Ww][Tt][Hh]|Free)\s*\+|\b(?:[Ss]tarter|[Gg]rowth|GROWTH|STARTER|Free|FREE)\s+(?:plan|tier|PLAN|TIER)s?\b|\bon\s+(?:the\s+)?(?:[Ss]tarter|STARTER)\b|\bon\s+Free\s*[.,;:)!]/;

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
      out.push(n.text);
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}

describe("no b2c copy names a retired plan", () => {
  it("the pattern catches the plan names in each form", () => {
    for (const bad of [
      "on Growth+ plans",
      "growth+ plans",
      "the Starter plan",
      "GROWTH tier",
      "Upgrade from your Free plan",
      "on the\n          Starter",
      "Schedule one at a time on Free.",
    ]) {
      expect(RETIRED.test(bad), bad).toBe(true);
    }
  });

  it("PASS: the pattern leaves pillar and ordinary uses alone", () => {
    for (const ok of [
      "Posts on the Growth tab",
      "on Growth campaigns",
      "free shipping",
      "We may offer free tiers, trials, or promotional pricing",
      "Start free",
      "Growth",
    ]) {
      expect(RETIRED.test(ok), ok).toBe(false);
    }
  });

  it("the extractor sees a literal in each form (string, template, JSX text)", () => {
    const found = texts("x.tsx", "const a = 'on Growth+ plans'; const b = `x ${a} Free plan`; const c = <p>the Starter plan</p>;");
    expect(found.filter((t) => RETIRED.test(t))).toHaveLength(3);
  });

  // ★A tree walk: worktrees with a junctioned node_modules run it slowly.
  it(
    "★no source file under src/ names a Starter, Growth or Free plan",
    () => {
      const files = sourceFiles(SRC);
      expect(files.length).toBeGreaterThan(100);
      const hits = files.flatMap((f) =>
        texts(f, readFileSync(f, "utf8"))
          .filter((t) => RETIRED.test(t))
          .map((t) => `${relative(SRC, f)}: ${JSON.stringify(t.trim().slice(0, 100))}`),
      );
      expect(hits).toEqual([]);
    },
    120_000,
  );
});
