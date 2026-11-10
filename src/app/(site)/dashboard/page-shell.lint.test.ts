/**
 * The layout contract in src/components/dashboard/page-shell.tsx, pinned.
 *
 *   1. A dashboard page.tsx's rendered root declares no frame of its own: no
 *      `max-w-*`, `mx-auto`, `container` or `p-*` (any side, any variant
 *      prefix). The dashboard layout owns padding and PageShell owns measure,
 *      so a page that re-declares either doubles or fights them.
 *   2. A page renders at most one <h1> per render path. PageHeader (and the
 *      growth-v2 PageHead, which delegates to it) IS an <h1>, so it counts.
 *
 * Read from the AST (as growth-v2-copy.test.ts does), never from text, so a
 * class named in a comment or a string that is not a className is not a hit.
 * Branches of a ternary are alternatives, not siblings: two headers in the
 * loading and loaded arms are one h1 per render.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const DASH = join(__dirname);

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : f === "page.tsx" ? [p] : [];
  });

const FRAME = /^(?:[\w-]+:)*(?:max-w-\S+|mx-auto|container|p[xytblrse]?-\S+)$/;

const parse = (source: string) => ts.createSourceFile("x.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const isFn = (n: ts.Node): n is ts.FunctionLikeDeclaration =>
  ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);

/** Return statements belonging to `fn` itself, not to a nested function. */
function returnsOf(fn: ts.Node): ts.Expression[] {
  const out: ts.Expression[] = [];
  const visit = (n: ts.Node) => {
    if (n !== fn && isFn(n)) return;
    if (ts.isReturnStatement(n) && n.expression) out.push(n.expression);
    ts.forEachChild(n, visit);
  };
  visit(fn);
  if ((ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) && fn.body) out.push(fn.body as ts.Expression);
  return out;
}

const unwrap = (e: ts.Expression): ts.Expression => (ts.isParenthesizedExpression(e) ? unwrap(e.expression) : e);

/** Root JSX elements a render path can produce (through ternaries, &&, fragments). */
function rootElements(e: ts.Expression): Array<ts.JsxElement | ts.JsxSelfClosingElement> {
  const x = unwrap(e);
  if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x)) return [x];
  if (ts.isJsxFragment(x)) {
    return x.children.flatMap((c) =>
      ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c) ? [c] : ts.isJsxExpression(c) && c.expression ? rootElements(c.expression) : [],
    );
  }
  if (ts.isConditionalExpression(x)) return [...rootElements(x.whenTrue), ...rootElements(x.whenFalse)];
  if (ts.isBinaryExpression(x)) return [...rootElements(x.right)];
  return [];
}

const tagOf = (el: ts.JsxElement | ts.JsxSelfClosingElement) =>
  (ts.isJsxElement(el) ? el.openingElement : el).tagName.getText();

/** The static class tokens on an element's className (string, or the literals in cn(...)). */
function classTokens(el: ts.JsxElement | ts.JsxSelfClosingElement): string[] {
  const attrs = (ts.isJsxElement(el) ? el.openingElement : el).attributes.properties;
  const out: string[] = [];
  for (const a of attrs) {
    if (!ts.isJsxAttribute(a) || a.name.getText() !== "className" || !a.initializer) continue;
    const visit = (n: ts.Node) => {
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(...n.text.split(/\s+/).filter(Boolean));
      else if (ts.isTemplateExpression(n)) out.push(...[n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join(" ").split(/\s+/).filter(Boolean));
      ts.forEachChild(n, visit);
    };
    visit(a.initializer);
  }
  return out;
}

/** The function a page.tsx exports as default. */
function defaultExportFn(sf: ts.SourceFile): ts.Node | undefined {
  let named: string | undefined;
  let found: ts.Node | undefined;
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) found = st;
    if (ts.isExportAssignment(st) && ts.isIdentifier(st.expression)) named = st.expression.text;
  }
  if (found || !named) return found;
  return sf.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === named);
}

/** Frame classes declared on the default export's rendered root(s). */
export function ownFrameIn(source: string): string[] {
  const sf = parse(source);
  const fn = defaultExportFn(sf);
  if (!fn) return [];
  const hits: string[] = [];
  for (const r of returnsOf(fn)) {
    for (const el of rootElements(r)) {
      if (tagOf(el) === "PageShell") continue;
      for (const t of classTokens(el)) if (FRAME.test(t)) hits.push(`<${tagOf(el)}> ${t}`);
    }
  }
  return hits;
}

const HEADINGS = new Set(["h1", "PageHeader", "PageHead"]);

/** The most <h1>s any one render path of any function in the file produces. */
export function maxH1In(source: string): number {
  const sf = parse(source);
  const count = (n: ts.Node): number => {
    if (isFn(n)) return 0; // callbacks (.map) are their own render scope
    if (ts.isConditionalExpression(n)) return count(n.condition) + Math.max(count(n.whenTrue), count(n.whenFalse));
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.BarBarToken) return count(n.left) + Math.max(0, count(n.right));
    let self = 0;
    if (ts.isJsxElement(n) && HEADINGS.has(n.openingElement.tagName.getText())) self = 1;
    if (ts.isJsxSelfClosingElement(n) && HEADINGS.has(n.tagName.getText())) self = 1;
    let sum = self;
    ts.forEachChild(n, (c) => {
      sum += count(c);
    });
    return sum;
  };
  let max = 0;
  const scan = (n: ts.Node) => {
    if (isFn(n)) for (const r of returnsOf(n)) max = Math.max(max, count(r));
    ts.forEachChild(n, scan);
  };
  scan(sf);
  return max;
}

const PAGES = walk(DASH).map((p) => ({ file: relative(DASH, p).replace(/\\/g, "/"), source: readFileSync(p, "utf8") }));

describe("dashboard page layout contract", () => {
  it("scans the dashboard pages", () => {
    expect(PAGES.length).toBeGreaterThan(50);
  });

  it.each(PAGES.map((p) => [p.file, p.source] as const))("%s declares no frame of its own", (_f, source) => {
    expect(ownFrameIn(source)).toEqual([]);
  });

  it.each(PAGES.map((p) => [p.file, p.source] as const))("%s renders at most one h1", (_f, source) => {
    expect(maxH1In(source)).toBeLessThanOrEqual(1);
  });
});

describe("the checks themselves", () => {
  const page = (body: string) => `export default function P() { return ${body}; }`;
  it("flags a root that opens its own frame", () => {
    expect(ownFrameIn(page(`<div className="mx-auto max-w-5xl p-4 md:p-6">x</div>`))).toEqual([
      "<div> mx-auto",
      "<div> max-w-5xl",
      "<div> p-4",
      "<div> md:p-6",
    ]);
    expect(ownFrameIn(page(`<div className={cn("space-y-6", "container")}>x</div>`))).toEqual(["<div> container"]);
  });
  it("flags a frame behind a ternary or a fragment", () => {
    expect(ownFrameIn(page(`a ? <div className="px-4" /> : <PageShell>x</PageShell>`))).toEqual(["<div> px-4"]);
    expect(ownFrameIn(page(`<><div className="max-w-3xl" /></>`))).toEqual(["<div> max-w-3xl"]);
  });
  it("lets a PageShell root and inner content classes through", () => {
    expect(ownFrameIn(page(`<PageShell width="wide"><div className="mx-auto max-w-sm p-4" /></PageShell>`))).toEqual([]);
    expect(ownFrameIn(page(`<div className="space-y-6">x</div>`))).toEqual([]);
  });
  it("counts two headings in one render path, not in alternative arms", () => {
    expect(maxH1In(page(`<PageShell><h1>a</h1><PageHeader title="b" /></PageShell>`))).toBe(2);
    expect(maxH1In(page(`a ? <PageShell><h1>a</h1></PageShell> : <PageShell><PageHeader title="b" /></PageShell>`))).toBe(1);
    // a callback is its own render scope: one h1 per item, never summed into the page
    expect(maxH1In(page(`<PageShell>{xs.map((x) => <h1 key={x}>{x}</h1>)}</PageShell>`))).toBe(1);
  });
});
