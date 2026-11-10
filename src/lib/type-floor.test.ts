import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";

/**
 * Type floor: nothing under src/ renders text below 12px. The smallest step is
 * the `text-micro` utility (globals.css, 12px/16px), also registered with
 * tailwind-merge in lib/utils.ts. A `text-[10px]`, `text-[11px]` or
 * `text-[0.65rem]` class is a regression back to unreadable chips.
 *
 * Read from the TypeScript AST (string, template and JSX text pieces), same as
 * no-retired-plan-names.test.ts, so a comment that explains the rule is not
 * mistaken for a use of it.
 */
const ROOT = resolve(__dirname, "..", "..");
const SRC = join(ROOT, "src");

/** text-[Npx] or text-[N rem/em] whose size is under 12px, any variant prefix. */
const BELOW_FLOOR = /text-\[(\d+(?:\.\d+)?)(px|rem|em)\]/g;
const px = (n: number, unit: string) => (unit === "px" ? n : n * 16);

/**
 * Files exempt from the floor, each with its reason. Empty: the last two
 * sub-12px sizes (in dashboard/layout.tsx) were migrated by #713. Add an
 * entry only with a reason a reviewer can check.
 */
const ALLOWED = new Set<string>();

function belowFloor(text: string): string[] {
  return [...text.matchAll(BELOW_FLOOR)].filter((m) => px(Number(m[1]), m[2]) < 12).map((m) => m[0]);
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
    if (ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || ts.isJsxText(n)) {
      out.push(n.text);
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}

describe("type floor", () => {
  it("the pattern flags sizes under 12px and nothing else", () => {
    expect(belowFloor("text-[10px]")).toEqual(["text-[10px]"]);
    expect(belowFloor("sm:text-[11px] hover:text-[8px]")).toHaveLength(2);
    expect(belowFloor("text-[0.65rem]")).toHaveLength(1);
    expect(belowFloor("text-[12px] text-[12.5px] text-[0.75rem] text-[13px] text-micro text-xs")).toEqual([]);
  });

  it("no source file under src/ uses a sub-12px text size", () => {
    const hits: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      if (ALLOWED.has(rel)) continue;
      const src = readFileSync(file, "utf8");
      if (!src.includes("text-[")) continue;
      for (const t of texts(file, src)) for (const h of belowFloor(t)) hits.push(`${rel}: ${h}`);
    }
    expect(hits, "use text-micro (12px) or larger").toEqual([]);
  });
});
