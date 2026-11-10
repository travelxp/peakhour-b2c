import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";

/**
 * JSX decodes only the XHTML 1.0 named entities. An HTML5-only name such as
 * `&check;` is NOT decoded and renders as the literal text "&check;" — which
 * is exactly what /shopify showed beside its hero ticks until this test.
 *
 * So every named entity written in JSX text or a JSX attribute string must be
 * one JSX knows. The set below is the XHTML names this codebase uses plus the
 * common typographic ones; a genuine XHTML name missing from it can be added
 * here. Anything else should be the literal character or an icon.
 *
 * Read from the TypeScript AST (raw JSX text and JSX attribute strings), same
 * approach as type-floor.test.ts, so comments explaining the rule never count.
 */
const ROOT = resolve(__dirname, "..", "..");
const SRC = join(ROOT, "src");

const XHTML_ENTITIES = new Set([
  "amp", "lt", "gt", "quot", "apos", "nbsp",
  "lsquo", "rsquo", "ldquo", "rdquo", "sbquo", "bdquo", "lsaquo", "rsaquo", "laquo", "raquo",
  "mdash", "ndash", "hellip", "middot", "bull", "prime", "Prime",
  "rarr", "larr", "uarr", "darr", "harr", "rArr", "lArr",
  "times", "divide", "plusmn", "minus", "deg", "micro", "para", "sect",
  "copy", "reg", "trade", "euro", "pound", "yen", "cent",
  "frac12", "frac14", "frac34", "sup2", "sup3", "le", "ge", "ne", "asymp", "infin",
  "hearts", "spades", "clubs", "diams", "dagger", "Dagger", "permil", "zwj", "zwnj",
]);

const NAMED = /&([a-zA-Z][a-zA-Z0-9]*);/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.tsx$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
}

/** Raw (undecoded) JSX text and JSX attribute string pieces. */
function jsxRaw(file: string, src: string): string[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: string[] = [];
  const walk = (n: ts.Node) => {
    if (ts.isJsxText(n)) out.push(n.getText(sf));
    else if (ts.isStringLiteral(n) && ts.isJsxAttribute(n.parent)) out.push(n.getText(sf));
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}

function unknownEntities(raw: string): string[] {
  return [...raw.matchAll(NAMED)].map((m) => m[1]).filter((name) => !XHTML_ENTITIES.has(name));
}

describe("JSX entities", () => {
  it("the check flags HTML5-only names and passes XHTML ones", () => {
    expect(unknownEntities("&check; done")).toEqual(["check"]);
    expect(unknownEntities("a &mdash; b &rarr; c &apos;d&apos; &amp;")).toEqual([]);
  });

  it("no JSX text or attribute uses an entity JSX does not decode", () => {
    const hits: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const src = readFileSync(file, "utf8");
      // Parse only files that contain a named entity at all (`&&` is in almost
      // every file, so a bare "&" filter would parse the whole tree).
      if (!/&[a-zA-Z][a-zA-Z0-9]*;/.test(src)) continue;
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      for (const piece of jsxRaw(file, src)) for (const name of unknownEntities(piece)) hits.push(`${rel}: &${name};`);
    }
    expect(hits).toEqual([]);
  });
});
