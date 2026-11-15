import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";

/**
 * One canonical origin: every absolute URL a page emits (canonical, og:url,
 * sitemap, robots `host`) is built from SITE.url, which is NEXT_PUBLIC_SITE_URL.
 * A literal https://peakhour.ai or https://www.peakhour.ai in code would be a
 * second origin that no environment can change, and it would point a canonical at
 * the wrong host the day production moves between the two.
 *
 * The one allowed home for the literal is the DEFAULT of SITE.url, in
 * src/lib/utils.ts.
 *
 * ★READ FROM THE TYPESCRIPT AST (strings, template pieces, JSX text), as
 * no-retired-plan-names.test.ts does: comments are not code and are not read, so a
 * doc comment that quotes a URL does not trip it.
 *
 * Links in legal copy are fine: a policy page may write the company's address
 * in prose. None does today; if one does, name it in ALLOWED_FILES with its words.
 */
const ROOT = resolve(__dirname, "..", "..", "..");
const SRC = join(ROOT, "src");
const ORIGIN = /https?:\/\/(?:www\.)?peakhour\.ai(?![\w.-])/i;
const ALLOWED_FILES = new Set(["src/lib/utils.ts"]);

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
    if (
      ts.isStringLiteralLike(n) ||
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

describe("one canonical origin", () => {
  it("the pattern catches both hosts and spares an email address or a subdomain", () => {
    expect(ORIGIN.test("https://peakhour.ai")).toBe(true);
    expect(ORIGIN.test("https://www.peakhour.ai/pricing")).toBe(true);
    expect(ORIGIN.test("http://peakhour.ai/x")).toBe(true);
    expect(ORIGIN.test("privacy@peakhour.ai")).toBe(false);
    expect(ORIGIN.test("https://api.peakhour.ai")).toBe(false);
    expect(ORIGIN.test("https://dev.peakhour.ai")).toBe(false);
    expect(ORIGIN.test("https://peakhour.ai.evil.com")).toBe(false);
  });

  it("no source file outside src/lib/utils.ts hard-codes the origin", () => {
    const hits: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const rel = relative(ROOT, file).split(String.fromCharCode(92)).join("/");
      if (ALLOWED_FILES.has(rel)) continue;
      const src = readFileSync(file, "utf8");
      if (!/peakhour\.ai/i.test(src)) continue;
      for (const t of texts(file, src)) if (ORIGIN.test(t)) hits.push(`${rel}: ${t.slice(0, 80)}`);
    }
    expect(hits).toEqual([]);
  }, 60_000);

  it("SITE.url is the only default, and it follows NEXT_PUBLIC_SITE_URL", () => {
    const utils = readFileSync(join(SRC, "lib", "utils.ts"), "utf8");
    expect(utils).toMatch(/url:\s*process\.env\.NEXT_PUBLIC_SITE_URL\s*\?\?/);
  });
});
