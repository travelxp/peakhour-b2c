/**
 * Merchants never see "Growth Council", "council", "Strategist", "Critic" or "Chair" (owner decision, 2026-10-28). The review is
 * "Peakhour Summit" and its seats are "The case for", "The case against", "Safety checks" and "Final call". Internal code keeps
 * `council` as its name, so this reads COPY (JSX text, string and template literals with a sentence in them, or a capitalised
 * label), never identifiers, property names or comments, from the AST.
 *
 * The trademark sign is on the badge or title and on the first mention on a screen. The registered sign appears nowhere.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { SUMMIT, SUMMIT_TM, withSummitTm } from "./growth-v2-copy";

const SRC = join(__dirname, "..");
const BANNED = /\b(council|strategist|critic|chair)\b/i;
const LABEL = /^(Council|Strategist|Critic|Chair)$/;
const TM = String.fromCharCode(0x2122);

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
    expect(copyIn('const a = { kind: "council_bet", council: 1 };')).toEqual([]);
    expect(copyIn("// the council\n/* Chair */ const council = 1;")).toEqual([]);
    expect(copyIn('type K = "holdout" | "council_bet";')).toEqual([]);
    expect(copyIn('const a = d.council ? <Seat who="The case for" /> : null;')).toEqual([]);
    expect(copyIn(`const a = <p>Peakhour Summit${TM} could not finish</p>;`)).toEqual([]);
  });

  it("lists real files (a lint over nothing passes)", () => {
    expect(FILES.length).toBeGreaterThan(30);
    expect(FILES.some((f) => f.endsWith("decision-card.tsx"))).toBe(true);
    expect(FILES.some((f) => f.endsWith("decisions-screen.tsx"))).toBe(true);
    expect(FILES.some((f) => f.endsWith("growth-v2-fixtures.ts"))).toBe(true);
  });

  it("★no growth screen holds a sentence or a label that names the council, strategist, critic or chair", () => {
    const found = FILES.flatMap((f) => copyIn(readFileSync(f, "utf8"), f).map((c) => `${relative(SRC, f)}:${c.line}  ${c.text.slice(0, 110)}`));
    expect(found).toEqual([]);
  });

  it("the registered sign appears nowhere in growth copy", () => {
    const sign = String.fromCharCode(0xae);
    expect(FILES.filter((f) => readFileSync(f, "utf8").includes(sign))).toEqual([]);
  });
});

describe("the trademark sign", () => {
  it("goes on the first mention only, and never twice", () => {
    expect(SUMMIT_TM).toBe(`${SUMMIT}${TM}`);
    expect(withSummitTm("A budget raise for Meta Ads is waiting for Peakhour Summit")).toBe(`A budget raise for Meta Ads is waiting for Peakhour Summit${TM}`);
    expect(withSummitTm("Peakhour Summit asked Peakhour Summit")).toBe(`Peakhour Summit${TM} asked Peakhour Summit`);
    expect(withSummitTm(withSummitTm("Peakhour Summit is here"))).toBe(`Peakhour Summit${TM} is here`);
    expect(withSummitTm("Nothing to name")).toBe("Nothing to name");
  });
});
