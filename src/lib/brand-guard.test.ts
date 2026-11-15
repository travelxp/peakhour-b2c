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
 */
const ROOT = resolve(__dirname, "..", "..");
const SRC = join(ROOT, "src");
const HOME = "src/components/shared/peakhour-logo.tsx";

const NAME = /^\s*peak\s?hour(?:\.ai)?\s*$/i;
const BRAND_FILES = /\/peakhour-(?:icon\.svg|logo\.png)/;
const OWN_COMPONENT = /^Peak\w*(?:Logo|Mark|Wordmark|Icon|Lockup)$/;
const INVENTED_ICON = "M5 24l8-11";
/** A cheap superset of the five rules, to skip parsing files that cannot break any of them. */
const MAY_VIOLATE = /peak\s?hour|SITE\.name|M5 24l8-11|Peak\w*(?:Logo|Mark|Wordmark|Icon|Lockup)|(?:^|[>}])\s*P\s*(?:$|[<{])/im;

/**
 * Places where the name is TEXT on purpose, each with a reason a reviewer can check. They name something as
 * another product shows it, where artwork would be wrong. Add an entry only for that.
 */
const ALLOWED_LABELS = new Map<string, string>([
  ["src/app/(site)/shopify/connect/_components/shopify-connect-status.tsx", "an instruction naming the app as it appears in Shopify's Apps list"],
  ["src/app/(site)/data-deletion/page.tsx", "an instruction naming the app as it appears in Facebook's settings"],
  ["src/components/marketing/shopify/shopify-owner-chat.tsx", "the contact name in a WhatsApp chat header mock-up: WhatsApp shows it as text (the avatar is the mark)"],
  ["src/components/growth-v2/decisions-screen.tsx", "the contact name in a WhatsApp chat header preview: WhatsApp shows it as text (the avatar is the mark)"],
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

  const onlyMeaningfulChild = (children: ts.NodeArray<ts.JsxChild>) => {
    const real = children.filter((c) => !(ts.isJsxText(c) && c.containsOnlyTriviaWhiteSpaces));
    return real.length === 1 ? real[0] : undefined;
  };

  const walk = (n: ts.Node) => {
    if (ts.isJsxElement(n)) {
      const only = onlyMeaningfulChild(n.children);
      if (only && ts.isJsxText(only) && NAME.test(only.text)) out.push({ rule: 1, text: only.text.trim() });
      if (only && ts.isJsxExpression(only) && only.expression?.getText(sf) === "SITE.name") out.push({ rule: 1, text: "{SITE.name}" });
      if (only && ts.isJsxText(only) && only.text.trim() === "P") out.push({ rule: 5, text: "P" });
    }
    if (!isHome && (ts.isStringLiteralLike(n) || ts.isJsxText(n)) && BRAND_FILES.test(n.text)) {
      out.push({ rule: 2, text: n.text.match(BRAND_FILES)![0] });
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
    expect(findBrandViolations(f, `const a = <a href="/">{SITE.name}</a>;`)).toEqual([{ rule: 1, text: "{SITE.name}" }]);
    expect(findBrandViolations(f, `const a = <img src="/peakhour-logo.png" />;`)).toEqual([{ rule: 2, text: "/peakhour-logo.png" }]);
    expect(findBrandViolations(f, `export function PeakMark() { return null; }`)).toEqual([{ rule: 3, text: "PeakMark" }]);
    expect(findBrandViolations(f, `const PeakhourIcon = () => null;`)).toEqual([{ rule: 3, text: "PeakhourIcon" }]);
    expect(findBrandViolations(f, `const a = <path d="M5 24l8-11 4 5 3-4 7 10z" />;`)).toEqual([{ rule: 4, text: INVENTED_ICON }]);
    expect(findBrandViolations(f, `const a = <span className="font-bold">P</span>;`)).toEqual([{ rule: 5, text: "P" }]);
    // The scan below skips files the pre-filter rejects, so the pre-filter must pass every one of these.
    for (const bad of [
      `<b>Peakhour</b>`, `<span>\n  Peakhour.ai\n</span>`, `<a>{SITE.name}</a>`, `"/peakhour-icon.svg"`,
      `function PeakMark() {}`, `"M5 24l8-11 4 5"`, `<span>P</span>`, `<div className="x">\n          P\n        </div>`,
    ]) {
      expect(MAY_VIOLATE.test(bad), bad).toBe(true);
    }
    // prose, the name inside a sentence, other products' marks, and comments are not brand labels
    expect(
      findBrandViolations(
        f,
        `// Peakhour <b>Peakhour</b> /peakhour-logo.png\nconst a = <p>Peakhour answers your customers.</p>;\nconst b = <p>Open <b>{SITE.name}</b> now and {SITE.name} helps.</p>;\nfunction ChannelLogo() { return null; }\nconst c = <span>{SITE.name} home</span>;`,
      ),
    ).toEqual([{ rule: 1, text: "{SITE.name}" }]);
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
      for (const v of findBrandViolations(file, text)) {
        if (v.rule === 1 && ALLOWED_LABELS.has(rel)) continue;
        found.push(`${rel}: rule ${v.rule}: ${v.text}`);
      }
    }
    expect(found, "Use PeakhourLogo / PeakhourWordmark / PeakhourMark from src/components/shared/peakhour-logo.tsx").toEqual([]);
  });

  it("every allow-listed file still needs its exemption (a stale entry is a hole)", () => {
    for (const rel of ALLOWED_LABELS.keys()) {
      const v = findBrandViolations(join(ROOT, rel), readFileSync(join(ROOT, rel), "utf8"));
      expect(v.some((x) => x.rule === 1), rel).toBe(true);
    }
  });

  it("the artwork is the official file's: seven mark shapes, eleven letter shapes, measured view boxes", () => {
    expect(BRAND_MARK_SHAPES).toHaveLength(7);
    expect(BRAND_WORD_SHAPES).toHaveLength(11);
    expect(LOCKUP_VIEWBOX).toBe("33 34 1088 214");
    expect(WORDMARK_VIEWBOX).toBe("285 85 836 117");
  });
});
