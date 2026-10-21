import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

/**
 * Owner, 2026-10-21: starter and growth are not plans, and D19 says there is
 * no free tier. The composer told a buyer auto-approve was "on Growth+ plans",
 * a plan the catalog does not have. Which plan carries a feature is the
 * catalog's to say, so the scheduler's copy names none.
 */
const DIR = __dirname;
const FILES = readdirSync(DIR).filter((f) => /\.tsx?$/.test(f) && !f.includes(".test."));
const RETIRED = /\b(Starter|Growth)\+|\bon (the )?(Starter|Growth|Free)\b|\b(Starter|Growth) plan/;

/**
 * Every string literal, template piece and JSX text run in a source file, from
 * the TypeScript AST. A regex lexer desyncs on a backtick inside a comment and
 * then skips the very literal it should catch (a first cut of this test did).
 * Doc comments are not copy and are not read.
 */
function texts(file: string, src: string): string[] {
  const out: string[] = [];
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, kind);
  const walk = (n: ts.Node) => {
    if (
      ts.isStringLiteral(n) ||
      ts.isNoSubstitutionTemplateLiteral(n) ||
      ts.isTemplateHead(n) ||
      ts.isTemplateMiddle(n) ||
      ts.isTemplateTail(n) ||
      ts.isJsxText(n)
    ) {
      out.push(n.text);
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}

describe("scheduler copy names no retired plan", () => {
  it("scans the composer and the callout", () => {
    expect(FILES).toEqual(expect.arrayContaining(["scheduler-composer.tsx", "upgrade-callout.tsx"]));
  });

  it("the extractor sees a literal in each form (string, template, JSX text)", () => {
    const found = texts("x.tsx", 'const a = "on Growth+ plans"; const b = `x ${a} on Free`; const c = <p>Growth plan</p>;');
    expect(found.filter((t) => RETIRED.test(t))).toHaveLength(3);
  });

  for (const file of FILES) {
    it(`★${file} names no Starter, Growth or Free plan`, () => {
      const src = readFileSync(resolve(DIR, file), "utf8");
      expect(texts(file, src).filter((t) => RETIRED.test(t))).toEqual([]);
    });
  }

  it("the auto-approve callout says what the plan lacks", () => {
    const src = readFileSync(resolve(DIR, "scheduler-composer.tsx"), "utf8");
    expect(src).toContain('<UpgradeCallout message="Your plan does not include auto-approve publishing." />');
  });
});
