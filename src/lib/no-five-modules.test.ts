import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// The voice guide retired "five modules" (docs/brand/website-voice.md). Nothing in src may render it. Like brand-guard.test.ts
// this reads the TypeScript AST, so comments are never text here and `//` or `/*` inside a string cannot hide a phrase.
const SRC = path.join(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Every string a file can render: string and template literals, and JSX text. */
function textsOf(code: string): string[] {
  const sf = ts.createSourceFile("f.tsx", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: string[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) out.push(n.text);
    else if (ts.isJsxText(n)) out.push(n.text);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

// Adjacent JSX pieces (`five{" "}modules`) are joined before matching.
const PHRASE = /\b(five|5)[ -]modules?\b/i;

describe("public copy", () => {
  it("never says five modules or 5 modules", () => {
    const hits = walk(SRC).filter((f) => PHRASE.test(textsOf(readFileSync(f, "utf8")).join(" ").replace(/\s+/g, " ")));
    expect(hits.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it("the matcher catches the phrase in a string, JSX text and a split JSX pair", () => {
    const probe = (code: string) => PHRASE.test(textsOf(code).join(" ").replace(/\s+/g, " "));
    expect(probe('const a = "All five modules";')).toBe(true);
    expect(probe("const a = <p>across 5 modules</p>;")).toBe(true);
    expect(probe('const a = <p>five{" "}modules</p>;')).toBe(true);
    expect(probe('// five modules\nconst a = "x // y";')).toBe(false);
  });
});
