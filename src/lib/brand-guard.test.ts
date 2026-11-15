import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";
import { BRAND_MARK_SHAPES, BRAND_WORD_SHAPES, LOCKUP_VIEWBOX, WORDMARK_VIEWBOX } from "@/lib/brand-artwork";

/**
 * ★THE BRAND IS THE OFFICIAL ARTWORK, EVERYWHERE. Owner rule, 2026-11-15, non-negotiable: wherever the Peakhour
 * logo or name stands as a brand, it is `PeakhourLogo`, `PeakhourWordmark` or `PeakhourMark`
 * (src/components/shared/peakhour-logo.tsx), drawn from src/lib/brand-artwork.ts.
 *
 * Why this test exists: the live coming-soon header shipped with an invented "peak and sun" icon and the name set
 * in a font. Nothing failed; this test now does. It reads the TypeScript AST (like no-hardcoded-colours.test.ts), so
 * prose that mentions Peakhour ("Peakhour answers your customers") is fine. It flags:
 *
 *   1. a JSX element whose ONLY content is the name: `<b>Peakhour</b>`, `<span>Peakhour.ai</span>`, `{SITE.name}`
 *      alone in an element (that is a brand label: use the artwork);
 *   2. any file but peakhour-logo.tsx pointing at the brand files (`/peakhour-icon.svg`, `/peakhour-logo.png`);
 *   3. any file but peakhour-logo.tsx defining its own Peakhour logo/mark/wordmark/icon component;
 *   4. the invented icon's path, should it ever come back;
 *   5. a letter logo: an element whose only content is "P" (the onboarding header and the growth WhatsApp preview
 *      both had one).
 *
 * Known limit: the name through a local alias (`const { name } = SITE; <b>{name}</b>`) is unknown text to the AST and
 * is not judged. Use `SITE.name` or `BRAND_NAME` directly; review catches the rest.
 */
const ROOT = resolve(__dirname, "..", "..");
const SRC = join(ROOT, "src");
const HOME = "src/components/shared/peakhour-logo.tsx";

const NAME = /^\s*peak\s?hour(?:\.ai)?\s*$/i;
/** Any Peakhour image file, with or without a leading slash or folder. */
const BRAND_FILES = /peakhour-[\w@-]*\.(?:svg|png|jpe?g|webp|gif)/i;
const OWN_COMPONENT = /^(?:Peak\w*|PH|Brand|Site|App)(?:Logo|Mark|Wordmark|Icon|Lockup)$/;
const INVENTED_ICON = "M5 24l8-11";
/** A cheap superset of the five rules, to skip parsing files that cannot break any of them. */
const MAY_VIOLATE =
  /peak\s?hour|SITE\s*\.\s*name|BRAND_NAME|M5 24l8-11|(?:Peak\w*|PH|Brand|Site|App)(?:Logo|Mark|Wordmark|Icon|Lockup)|(?:^|[>}"'`])\s*P\s*(?:$|[<{"'`])/im;

/**
 * Labels where the name is TEXT on purpose: file -> the exact labels allowed there, each with a reason a reviewer
 * can check. They name something as another product shows it, where artwork would be wrong. The count is exact, so
 * a second typed label in the same file still fails, and so does a stale entry.
 */
const ALLOWED_LABELS = new Map<string, { labels: string[]; reason: string }>([
  ["src/app/(site)/shopify/connect/_components/shopify-connect-status.tsx", { labels: ["Peakhour.ai"], reason: "an instruction naming the app as Shopify's Apps list shows it (shopify.app.toml name)" }],
  ["src/app/(site)/data-deletion/page.tsx", { labels: ["Peakhour.ai"], reason: "an instruction naming the app as Facebook's settings show it" }],
  ["src/components/marketing/shopify/shopify-owner-chat.tsx", { labels: ["Peakhour"], reason: "the contact name in a WhatsApp chat header mock-up; WhatsApp shows it as text (the avatar is the mark)" }],
  ["src/components/growth-v2/decisions-screen.tsx", { labels: ["Peakhour"], reason: "the contact name in a WhatsApp chat header preview; WhatsApp shows it as text (the avatar is the mark)" }],
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(tsx|ts)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
}

export type BrandViolation = { rule: 1 | 2 | 3 | 4 | 5; text: string };

/** Every rule break in one file's source. Exported so the rules themselves are tested below. */
export function findBrandViolations(file: string, src: string): BrandViolation[] {
  const out: BrandViolation[] = [];
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const isHome = file.replace(/\\/g, "/").endsWith(HOME);

  /**
   * The text an element shows, read across its children: JSX text, string literals, the name constants and nested
   * elements. A self-closing element (an icon, an image) adds no text, so "drawn icon + typed name" reads as the
   * name. Any other expression is unknown text, so the element is not judged (null).
   */
  const shown = (children: ts.NodeArray<ts.JsxChild>): string | null => {
    let text = "";
    for (const c of children) {
      if (ts.isJsxText(c)) text += c.text;
      else if (ts.isJsxSelfClosingElement(c)) continue;
      else if (ts.isJsxElement(c) || ts.isJsxFragment(c)) {
        const inner = shown(c.children);
        if (inner === null) return null;
        text += inner;
      } else if (ts.isJsxExpression(c)) {
        const e = c.expression;
        if (!e) continue;
        if (ts.isStringLiteralLike(e)) text += e.text;
        else if (/^(?:SITE\.name|BRAND_NAME)$/.test(e.getText(sf).replace(/\s+/g, ""))) text += "Peakhour.ai";
        else return null;
      }
    }
    return text.replace(/\s+/g, " ").trim();
  };

  const walk = (n: ts.Node) => {
    if (ts.isJsxElement(n) || ts.isJsxFragment(n)) {
      const t = shown(n.children);
      if (t !== null && NAME.test(t)) {
        out.push({ rule: 1, text: t });
        return; // one finding per label, not one per wrapper
      }
      if (t === "P") {
        out.push({ rule: 5, text: "P" });
        return;
      }
    }
    if (!isHome && (ts.isStringLiteralLike(n) || ts.isJsxText(n)) && BRAND_FILES.test(n.text)) {
      out.push({ rule: 2, text: n.text.match(BRAND_FILES)![0] });
    }
    // `/peakhour-${variant}.svg`: a built path is still a path to the brand files.
    if (!isHome && ts.isTemplateExpression(n) && /peakhour-/i.test(n.getText(sf))) {
      out.push({ rule: 2, text: n.getText(sf) });
    }
    if (!isHome) {
      const name =
        ts.isFunctionDeclaration(n) && n.name ? n.name.text
        : ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer)) ? n.name.text
        : undefined;
      if (name && OWN_COMPONENT.test(name)) out.push({ rule: 3, text: name });
    }
    if (ts.isStringLiteralLike(n) && n.text.includes(INVENTED_ICON)) out.push({ rule: 4, text: INVENTED_ICON });
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}

describe("brand guard: the official artwork, everywhere", () => {
  it("the rules catch each way the brand has been faked, and leave prose alone", () => {
    const f = "src/x.tsx";
    expect(findBrandViolations(f, `const a = <b className="x">Peakhour</b>;`)).toEqual([{ rule: 1, text: "Peakhour" }]);
    expect(findBrandViolations(f, `const a = <span>\n  Peakhour.ai\n</span>;`)).toEqual([{ rule: 1, text: "Peakhour.ai" }]);
    expect(findBrandViolations(f, `const a = <a href="/">{SITE.name}</a>;`)).toEqual([{ rule: 1, text: "Peakhour.ai" }]);
    expect(findBrandViolations(f, `const a = <img src="/peakhour-logo.png" />;`)).toEqual([{ rule: 2, text: "peakhour-logo.png" }]);
    expect(findBrandViolations(f, `export function PeakMark() { return null; }`)).toEqual([{ rule: 3, text: "PeakMark" }]);
    expect(findBrandViolations(f, `const PeakhourIcon = () => null;`)).toEqual([{ rule: 3, text: "PeakhourIcon" }]);
    expect(findBrandViolations(f, `const a = <path d="M5 24l8-11 4 5 3-4 7 10z" />;`)).toEqual([{ rule: 4, text: INVENTED_ICON }]);
    expect(findBrandViolations(f, `const a = <span className="font-bold">P</span>;`)).toEqual([{ rule: 5, text: "P" }]);
    // the ways the first version missed: fragments, literals, the constant, a name split across children,
    // a drawn icon beside the typed name (the live header's exact shape), and asset paths without a slash
    expect(findBrandViolations(f, `const a = <>Peakhour</>;`)).toEqual([{ rule: 1, text: "Peakhour" }]);
    expect(findBrandViolations(f, `const a = <b>{"Peakhour"}</b>;`)).toEqual([{ rule: 1, text: "Peakhour" }]);
    expect(findBrandViolations(f, `const a = <b>{BRAND_NAME}</b>;`)).toEqual([{ rule: 1, text: "Peakhour.ai" }]);
    expect(findBrandViolations(f, `const a = <span>{SITE .name}</span>;`)).toEqual([{ rule: 1, text: "Peakhour.ai" }]);
    expect(findBrandViolations(f, `const a = <span>Peakhour<span className="text-gold">.ai</span></span>;`)).toEqual([{ rule: 1, text: "Peakhour.ai" }]);
    expect(findBrandViolations(f, `const a = <Link href="/"><span className="tile"><Icon /></span>{SITE.name}</Link>;`)).toEqual([{ rule: 1, text: "Peakhour.ai" }]);
    expect(findBrandViolations(f, `const a = <span>{"P"}</span>;`)).toEqual([{ rule: 5, text: "P" }]);
    expect(findBrandViolations(f, `const a = <img src="peakhour-logo.png" />;`)).toEqual([{ rule: 2, text: "peakhour-logo.png" }]);
    expect(findBrandViolations(f, `const a = <img src="/brand/peakhour-mark.svg" />;`)).toEqual([{ rule: 2, text: "peakhour-mark.svg" }]);
    expect(findBrandViolations(f, `function BrandLogo() { return null; }`)).toEqual([{ rule: 3, text: "BrandLogo" }]);
    expect(findBrandViolations(f, `const PHMark = () => null;`)).toEqual([{ rule: 3, text: "PHMark" }]);
    expect(findBrandViolations(f, "const a = <img src={`/peakhour-${v}.svg`} />;")).toEqual([{ rule: 2, text: "`/peakhour-${v}.svg`" }]);
    expect(findBrandViolations(f, "const a = <span>{'P'}</span>;")).toEqual([{ rule: 5, text: "P" }]);
    // The scan below skips files the pre-filter rejects, so the pre-filter must pass every one of these.
    for (const bad of [
      `<b>Peakhour</b>`, `<span>\n  Peakhour.ai\n</span>`, `<a>{SITE.name}</a>`, `"/peakhour-icon.svg"`,
      `function PeakMark() {}`, `"M5 24l8-11 4 5"`, `<span>P</span>`, `<div className="x">\n          P\n        </div>`,
      `<>Peakhour</>`, `<b>{BRAND_NAME}</b>`, `<span>{SITE .name}</span>`, `<span>{"P"}</span>`, `src="peakhour-logo.png"`,
      `function BrandLogo() {}`, `const PHMark = () => null`, `<span>{'P'}</span>`, "<span>{`P`}</span>",
    ]) {
      expect(MAY_VIOLATE.test(bad), bad).toBe(true);
    }
    // prose, the name inside a sentence, other products' marks, and comments are not brand labels
    expect(
      findBrandViolations(
        f,
        `// Peakhour <b>Peakhour</b> /peakhour-logo.png\nconst a = <p>Peakhour answers your customers.</p>;\nconst b = <p>Open <b>{SITE.name}</b> now and {SITE.name} helps.</p>;\nfunction ChannelLogo() { return null; }\nconst c = <span>{SITE.name} home</span>;`,
      ),
    ).toEqual([{ rule: 1, text: "Peakhour.ai" }]);
  });

  it("the shared logo module is the one place allowed to touch the brand files and define the components", () => {
    const home = join(ROOT, HOME);
    expect(findBrandViolations(home, readFileSync(home, "utf8"))).toEqual([]);
  });

  it("no file in src fakes the brand", { timeout: 60_000 }, () => {
    const found: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      const text = readFileSync(file, "utf8");
      // Parse only files that could break a rule: the whole tree through the TS parser is too slow.
      if (!MAY_VIOLATE.test(text)) continue;
      const allowed = [...(ALLOWED_LABELS.get(rel)?.labels ?? [])];
      for (const v of findBrandViolations(file, text)) {
        const i = v.rule === 1 ? allowed.indexOf(v.text) : -1;
        if (i >= 0) {
          allowed.splice(i, 1); // each allowed label covers exactly one occurrence
          continue;
        }
        found.push(`${rel}: rule ${v.rule}: ${v.text}`);
      }
    }
    expect(found, "Use PeakhourLogo / PeakhourWordmark / PeakhourMark from src/components/shared/peakhour-logo.tsx").toEqual([]);
  });

  it("every allow-listed label is still there, exactly (a stale entry is a hole)", () => {
    for (const [rel, { labels }] of ALLOWED_LABELS) {
      const hits = findBrandViolations(join(ROOT, rel), readFileSync(join(ROOT, rel), "utf8"))
        .filter((x) => x.rule === 1)
        .map((x) => x.text);
      expect(hits.sort(), rel).toEqual([...labels].sort());
    }
  });

  it("the artwork is the official file's: seven mark shapes, eleven letter shapes, measured view boxes", () => {
    expect(BRAND_MARK_SHAPES).toHaveLength(7);
    expect(BRAND_WORD_SHAPES).toHaveLength(11);
    expect(LOCKUP_VIEWBOX).toBe("33 34 1088 214");
    expect(WORDMARK_VIEWBOX).toBe("285 85 836 117");
  });
});
