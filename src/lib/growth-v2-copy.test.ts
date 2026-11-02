/**
 * Merchants never see "Growth Council", "council", "Strategist", "Critic" or "Chair" (owner decision, 2026-10-28). The review is
 * "Peakhour Summit" and its seats are "The case for", "The case against", "Safety checks" and "Final call". Internal code keeps
 * `council` as its name, so this reads COPY (JSX text, string and template literals with a sentence in them, or a capitalised
 * label), never identifiers, property names or comments, from the AST.
 *
 * Always plain "Peakhour Summit": neither the trademark nor the registered sign appears in the scanned growth files (owner, 2026-11-02).
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { SUMMIT } from "./growth-v2-copy";

const SRC = join(__dirname, "..");
const BANNED = /\b(council|strategist|critic|chair)\b/i;
const LABEL = /^(Council|Strategist|Critic|Chair)$/;
const TM = String.fromCharCode(0x2122);
/** The trademark or registered sign: typed, as a JS escape or char code, or as an HTML entity. */
const hasSign = (text: string) => /[™®]|\\u(2122|00ae)|\\u\{0*(2122|ae)\}|\\xae|fromCharCode\(\s*(0x0*(2122|ae)|8482|174)\s*\)|&(trade|reg|#8482|#174|#x0*(2122|ae));/i.test(text);

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(p) && !/\.test\.(ts|tsx)$/.test(p) ? [p] : [];
  });

/** The growth screens a merchant reads: the v2 components, their libs and every growth dashboard page. */
const FILES = [
  ...walk(join(SRC, "components", "growth-v2")),
  ...walk(join(SRC, "app", "(site)", "dashboard", "growth")),
  ...readdirSync(join(SRC, "lib"))
    .filter((f) => /^growth-v2.*\.tsx?$/.test(f) && !/\.test\./.test(f))
    .map((f) => join(SRC, "lib", f)),
  join(SRC, "lib", "api", "growth-v2.ts"),
];

/** Strings that reach a person, with their line. */
export function copyIn(source: string, fileName = "x.tsx"): Array<{ text: string; line: number }> {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: Array<{ text: string; line: number }> = [];
  const take = (node: ts.Node, text: string) => {
    const t = text.trim();
    if (!(/\s/.test(t) || LABEL.test(t))) return;
    if (!BANNED.test(t)) return;
    // An object key, an import path and a type position are never copy.
    if (node.parent && ts.isPropertyAssignment(node.parent) && node.parent.name === node) return;
    for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
      if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isTypeNode(p)) return;
      if (ts.isCallExpression(p) && /^console\.\w+$/.test(p.expression.getText(sf))) return;
    }
    out.push({ text: t, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 });
  };
  const visit = (n: ts.Node): void => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) take(n, n.text);
    else if (ts.isTemplateExpression(n)) take(n, [n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join(" ${} "));
    else if (ts.isJsxText(n)) take(n, n.text);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

describe("merchant-facing growth copy never names the council's internal seats", () => {
  it("the scan reads copy and ignores codes, comments and identifiers (a FAIL and a PASS for each)", () => {
    expect(copyIn("const a = <b>Growth Council</b>;")).toHaveLength(1);
    expect(copyIn('const a = <Seat who="Strategist" />;')).toHaveLength(1);
    expect(copyIn('const a = <Seat who="Chair\'s decision" />;')).toHaveLength(1);
    expect(copyIn('const a = "The council says no";')).toHaveLength(1);
    expect(copyIn("const a = `${n} council bets`;")).toHaveLength(1);
    expect(copyIn("const a = <p>Ask what the critic said.</p>;")).toHaveLength(1);
    // the line a stale checkout still shows in first-run-screen.tsx (master dropped it in the cleanup): the scan must catch it
    expect(copyIn("const a = <CardDescription>Drafted by the Growth Council from the {m.playbook.id} playbook. Your own data takes over from about week 4.</CardDescription>;")).toHaveLength(1);
    expect(copyIn('const a = { kind: "council_bet", council: 1 };')).toEqual([]);
    expect(copyIn("// the council\n/* Chair */ const council = 1;")).toEqual([]);
    expect(copyIn('type K = "holdout" | "council_bet";')).toEqual([]);
    expect(copyIn('const a = d.council ? <Seat who="The case for" /> : null;')).toEqual([]);
    expect(copyIn(`const a = <p>${SUMMIT} could not finish</p>;`)).toEqual([]);
  });

  it("lists real files (a lint over nothing passes)", () => {
    expect(FILES.length).toBeGreaterThan(30);
    expect(FILES.some((f) => f.endsWith("decision-card.tsx"))).toBe(true);
    expect(FILES.some((f) => f.endsWith("decisions-screen.tsx"))).toBe(true);
    expect(FILES.some((f) => f.endsWith("first-run-screen.tsx"))).toBe(true);
    expect(FILES.some((f) => f.endsWith("growth-v2-fixtures.ts"))).toBe(true);
  });

  it("★no growth screen holds a sentence or a label that names the council, strategist, critic or chair", () => {
    const found = FILES.flatMap((f) => copyIn(readFileSync(f, "utf8"), f).map((c) => `${relative(SRC, f)}:${c.line}  ${c.text.slice(0, 110)}`));
    expect(found).toEqual([]);
  }, 60_000);

  it("neither the trademark nor the registered sign appears in the growth screens, in any spelling", () => {
    // FAIL and PASS for the matcher first, so a pattern that matches nothing cannot pass the scan below
    expect(hasSign(`<p>${SUMMIT}${TM}</p>`)).toBe(true);
    expect(hasSign('const s = "Peakhour Summit\\u2122";')).toBe(true);
    expect(hasSign("<p>&trade;</p>")).toBe(true);
    expect(hasSign("<p>{SUMMIT}&#x2122;</p>")).toBe(true);
    expect(hasSign('const s = "\\u{2122}";')).toBe(true);
    expect(hasSign('const s = "\\xae";')).toBe(true);
    expect(hasSign("const MARK = String.fromCharCode(0x2122);")).toBe(true);
    expect(hasSign("const MARK = String.fromCharCode(174);")).toBe(true);
    expect(hasSign(`<p>${SUMMIT}</p>`)).toBe(false);
    expect(FILES.filter((f) => hasSign(readFileSync(f, "utf8")))).toEqual([]);
  }, 60_000);
});

