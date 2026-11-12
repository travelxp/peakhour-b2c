/**
 * Every dashboard list / table page uses the one shared toolbar
 * (src/components/molecules/data-table/data-toolbar.tsx): search on the left,
 * tabs and filters next, view / column controls on the right, wrapping on a
 * phone. This pins it from the AST (as page-shell.lint.test.ts does), so a
 * class or placeholder named in a comment or string is not a hit.
 *
 *   A. A search box (an <Input> whose placeholder or aria-label says
 *      "search", or type="search") must sit inside <DataToolbar>
 *      (DataToolbarSearch is the slot for it).
 *   B. In a file that renders a table (<Table> or <DataTable>), a filter
 *      <Select> / <select> must sit inside <DataToolbar>.
 *
 * Pages in another lane (overview, insights/search-console) have no stray
 * control today, so they need no allowlist entry.
 *
 * Scope: every non-test .tsx under dashboard/, plus the shared components
 * that dashboard pages mount as their body (EXTRA_FILES).
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";

const DASH = __dirname;
const SRC = join(__dirname, "..", "..", "..");

/** Shared components that are a dashboard page's whole body. */
const EXTRA_FILES = [
  "components/dashboard/team-section.tsx",
  "components/commerce/knowledge-base.tsx",
];

/**
 * Allowed outside the toolbar, each for a stated reason (path under src/ ->
 * why). Keep the reason honest; a new entry needs one.
 */
export const ALLOW: Record<string, string> = {
  // Report / campaign tables whose selects belong to a form or report picker inside a Card (not a list filter).
  "app/(site)/dashboard/ads/_components/google-reports-section.tsx": "report picker inside a card, not a list filter",
  "app/(site)/dashboard/ads/_components/google-ads-panel.tsx": "campaign editor selects inside a card",
  "app/(site)/dashboard/ads/_components/meta-ads-panel.tsx": "campaign editor selects inside a card",
  "app/(site)/dashboard/ads/_components/x-ads-panel.tsx": "campaign editor selects inside a card",
};

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return walk(p);
    return f.endsWith(".tsx") && !/\.test\.tsx$/.test(f) ? [p] : [];
  });

const parse = (source: string) => ts.createSourceFile("x.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const nameOf = (n: ts.JsxOpeningLikeElement) => n.tagName.getText();

function attr(n: ts.JsxOpeningLikeElement, name: string): ts.JsxAttribute | undefined {
  return n.attributes.properties.find((a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText() === name);
}

const attrText = (a: ts.JsxAttribute | undefined) => (a?.initializer ? a.initializer.getText() : "");

/** Violations in `source`: search boxes (A) and, in table files, filter selects (B), outside DataToolbar. */
export function strayControlsIn(source: string): string[] {
  const sf = parse(source);
  let rendersTable = false;
  const controls: Array<{ kind: "search" | "select"; label: string }> = [];

  const visit = (n: ts.Node, inToolbar: boolean) => {
    let nowIn = inToolbar;
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
      const open = ts.isJsxElement(n) ? n.openingElement : n;
      const tag = nameOf(open);
      if (tag === "DataToolbar") nowIn = true;
      if (tag === "Table" || tag === "DataTable") rendersTable = true;
      if (!nowIn) {
        if (tag === "Input") {
          const hint = `${attrText(attr(open, "placeholder"))} ${attrText(attr(open, "aria-label"))} ${attrText(attr(open, "type"))}`;
          if (/search/i.test(hint)) controls.push({ kind: "search", label: hint.trim() });
        }
        if (tag === "Select" || tag === "select") controls.push({ kind: "select", label: tag });
      }
    }
    ts.forEachChild(n, (c) => visit(c, nowIn));
  };
  visit(sf, false);

  return controls
    .filter((c) => c.kind === "search" || rendersTable)
    .map((c) => (c.kind === "search" ? `search input (${c.label})` : `filter <${c.label}> in a table file`));
}

const files = [...walk(DASH), ...EXTRA_FILES.map((f) => join(SRC, f))];

describe("dashboard list pages use the shared DataToolbar", () => {
  it("scans the files it means to", () => {
    expect(files.length).toBeGreaterThan(50);
    for (const f of EXTRA_FILES) expect(statSync(join(SRC, f)).isFile()).toBe(true);
  });

  it("no search box or table filter sits outside <DataToolbar>", () => {
    const bad: string[] = [];
    for (const f of files) {
      const rel = relative(SRC, f).split(sep).join("/");
      if (rel in ALLOW) continue;
      for (const v of strayControlsIn(readFileSync(f, "utf8"))) bad.push(`${rel}: ${v}`);
    }
    expect(bad).toEqual([]);
    // Parses every dashboard file; slow in a junctioned worktree under load.
  }, 30_000);

  it("every allowlist entry is still needed", () => {
    const stale = Object.keys(ALLOW).filter((rel) => {
      try {
        return strayControlsIn(readFileSync(join(SRC, rel), "utf8")).length === 0;
      } catch {
        return true;
      }
    });
    expect(stale).toEqual([]);
  }, 30_000);

  it("flags a search input or table filter outside the toolbar, passes one inside", () => {
    const outside = `export default function P(){return <div><Input placeholder="Search x" /><Table /></div>}`;
    const inside = `export default function P(){return <div><DataToolbar search={<DataToolbarSearch aria-label="Search x" />} filters={<Select />} /><Table /></div>}`;
    const selectOnly = `export default function P(){return <div><Select /><Table /></div>}`;
    const selectNoTable = `export default function P(){return <div><Select /></div>}`;
    expect(strayControlsIn(outside)).toHaveLength(1);
    expect(strayControlsIn(inside)).toEqual([]);
    expect(strayControlsIn(selectOnly)).toHaveLength(1);
    expect(strayControlsIn(selectNoTable)).toEqual([]);
  });
});
