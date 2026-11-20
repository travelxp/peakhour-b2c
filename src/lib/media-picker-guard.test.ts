import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";

/**
 * ★THERE IS ONE MEDIA PICKER. Owner rule, 2026-11-20: "It should be the only image picker in the entire Platform."
 * Every place that takes an image, a video or a document for a post, an ad, a page or a message opens `DrivePicker`
 * (src/components/drive/drive-picker.tsx), which applies the destination's rules and sends the file through Drive.
 *
 * This test reads the TypeScript AST of every source file (like brand-guard.test.ts) and refuses, outside the allowlist below:
 *   1. a file input: `type="file"` in JSX, `type: "file"` in a props object, or `x.type = "file"`;
 *   2. `useDropzone` or `showOpenFilePicker` (another way to open a file chooser);
 *   3. an import of the diceui file-upload primitive, or of react-dropzone, outside the picker module;
 *   4. an image-link input: a placeholder, label or title that asks for an image address ("Paste an image URL", "https://…/photo.jpg"), and a
 *      text box (Input, Textarea, input, textarea) with NO placeholder whose id, name, aria-label, title or enclosing Field label speaks of
 *      image, logo, photo or picture addresses, links or URLs ("Logos — one https:// address per line").
 *
 * Known limit: a file chooser built from something this test does not name (a new library) is not seen. A reviewer adding one is
 * asked by rule 3's reason to use the picker; the allowlist has a reason per entry so that it can be checked.
 */
const ROOT = resolve(__dirname, "..", "..");
const SRC = join(ROOT, "src");

/** file -> why it may open a file chooser or take a link. A stale entry (a file with no violation left) fails too. */
const ALLOWED = new Map<string, string>([
  ["src/components/ui/file-upload.tsx", "the diceui file-upload primitive the picker is built on; nothing else imports it"],
  ["src/components/drive/drive-picker-upload.tsx", "the picker module: the Upload tab's dropzone and the Link tab's address box"],
  ["src/app/(site)/dashboard/drive/page.tsx", "Drive's own page: its source of files"],
  ["src/components/drive/replace-file.tsx", "Drive's own page: replacing a file in place keeps its address, so it is not 'add a file to a place'"],
  ["src/app/(site)/dashboard/content/sources/components/add-source-drawer.tsx", "an OPML or XML import of feed sources: a list of feeds, not media"],
  ["src/app/(site)/dashboard/integrations/_components/connect-modals.tsx", "the Apple .p8 key: a credential, which must never enter Drive"],
  ["src/app/(site)/dashboard/ads/_components/meta-campaign-dialogs.tsx", "TEMPORARY: PK-2 moves the Meta ad image onto the picker and removes this entry"],
]);

const IMAGE_LINK_ASK = /(?:paste|enter|add|type)\s+(?:an?\s+)?(?:image|photo|picture)\s+(?:url|link|address)|image\s+(?:url|link|address)|https?:\/\/\S*\.(?:jpe?g|png|gif|webp)\b/i;
/** A text box whose own words or whose Field's label ask for a picture's address: both a picture word and an address word. */
const IMAGE_ADDRESS_WORDS = /\b(?:image|logo|photo|picture)s?\b[^.]{0,60}\b(?:url|link|address)(?:es|s)?\b|\b(?:url|link|address)(?:es|s)?\b[^.]{0,30}\b(?:image|logo|photo|picture)s?\b/i;
const TEXT_BOXES = new Set(["Input", "Textarea", "input", "textarea"]);
const BOX_WORD_ATTRS = new Set(["id", "name", "aria-label", "title", "placeholder"]);
const PROMPTING_ATTRS = new Set(["placeholder", "aria-label", "title", "label"]);
const CHOOSER_IDENTIFIERS = new Set(["useDropzone", "showOpenFilePicker"]);
const FORBIDDEN_IMPORT = /^(?:react-dropzone|@diceui\/[\w-]*file-upload|@\/components\/ui\/file-upload|(?:\.{1,2}\/)+(?:components\/)?ui\/file-upload)$/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(tsx|ts)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
}

export type PickerViolation = { rule: 1 | 2 | 3 | 4; text: string };

/** Every rule break in one file's source. Exported so the rules themselves are tested below. */
export function findPickerViolations(file: string, src: string): PickerViolation[] {
  const out: PickerViolation[] = [];
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const isFileLiteral = (n: ts.Node | undefined): boolean => !!n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && n.text === "file";
  const visit = (n: ts.Node) => {
    if (ts.isJsxAttribute(n) && ts.isIdentifier(n.name)) {
      const name = n.name.text;
      const init = n.initializer;
      const literal = init && ts.isStringLiteral(init) ? init : init && ts.isJsxExpression(init) && init.expression && (ts.isStringLiteral(init.expression) || ts.isNoSubstitutionTemplateLiteral(init.expression)) ? init.expression : undefined;
      if (name === "type" && isFileLiteral(literal)) out.push({ rule: 1, text: 'type="file"' });
      // a text box is judged whole, below (its own words and its Field's), so its attributes are not counted twice
      const owner = n.parent.parent;
      const inTextBox = (ts.isJsxSelfClosingElement(owner) || ts.isJsxOpeningElement(owner)) && TEXT_BOXES.has(owner.tagName.getText(sf));
      if (!inTextBox && PROMPTING_ATTRS.has(name) && literal && IMAGE_LINK_ASK.test(literal.text)) out.push({ rule: 4, text: `${name}="${literal.text}"` });
    }
    if ((ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) && TEXT_BOXES.has(n.tagName.getText(sf))) {
      const words: string[] = [];
      const literalsOf = (node: ts.Node) => {
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) words.push(node.text);
        // a template with ${...} in it: its fixed pieces, joined, read as one sentence
        if (ts.isTemplateExpression(node)) words.push([node.head.text, ...node.templateSpans.map((t) => t.literal.text)].join(" "));
        ts.forEachChild(node, literalsOf);
      };
      for (const a of n.attributes.properties) {
        if (ts.isJsxAttribute(a) && ts.isIdentifier(a.name) && BOX_WORD_ATTRS.has(a.name.text) && a.initializer) literalsOf(a.initializer);
      }
      // the Field around it names it too: <Field label="Logos - one https:// address per line"><Textarea/></Field>
      for (let up: ts.Node | undefined = n.parent, depth = 0; up && depth < 4; up = up.parent, depth++) {
        const open = ts.isJsxElement(up) ? up.openingElement : undefined;
        if (!open) continue;
        for (const a of open.attributes.properties) if (ts.isJsxAttribute(a) && ts.isIdentifier(a.name) && a.name.text === "label" && a.initializer) literalsOf(a.initializer);
      }
      const said = words.find((w) => IMAGE_ADDRESS_WORDS.test(w) || IMAGE_LINK_ASK.test(w));
      if (said) out.push({ rule: 4, text: `${n.tagName.getText(sf)} for "${said}"` });
    }
    if (ts.isPropertyAssignment(n) && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)) && n.name.text === "type" && isFileLiteral(n.initializer)) out.push({ rule: 1, text: 'type: "file"' });
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(n.left) && n.left.name.text === "type" && isFileLiteral(n.right)) out.push({ rule: 1, text: '.type = "file"' });
    if (ts.isIdentifier(n) && CHOOSER_IDENTIFIERS.has(n.text)) out.push({ rule: 2, text: n.text });
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && FORBIDDEN_IMPORT.test(n.moduleSpecifier.text)) out.push({ rule: 3, text: n.moduleSpecifier.text });
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

const MAY_VIOLATE = /type\s*[=:]\s*["'`]file|\.type\s*=|useDropzone|showOpenFilePicker|react-dropzone|file-upload|image|photo|picture|logo|address|url|link|\.(?:jpe?g|png|gif|webp)/i;

describe("the picker guard's rules", () => {
  it("sees each way of opening a file chooser", () => {
    expect(findPickerViolations("a.tsx", `export const A = () => <input type="file" />;`)).toEqual([{ rule: 1, text: 'type="file"' }]);
    expect(findPickerViolations("a.tsx", `export const A = () => <input type={"file"} />;`)).toEqual([{ rule: 1, text: 'type="file"' }]);
    expect(findPickerViolations("a.ts", `h("input", { type: "file" });`)).toEqual([{ rule: 1, text: 'type: "file"' }]);
    expect(findPickerViolations("a.ts", `const i = document.createElement("input"); i.type = "file";`)).toEqual([{ rule: 1, text: '.type = "file"' }]);
    expect(findPickerViolations("a.ts", `const { getRootProps } = useDropzone({});`)).toEqual([{ rule: 2, text: "useDropzone" }]);
    expect(findPickerViolations("a.ts", `await window.showOpenFilePicker();`)).toEqual([{ rule: 2, text: "showOpenFilePicker" }]);
  });

  it("sees an import of the primitive, however it is spelled", () => {
    expect(findPickerViolations("a.tsx", `import { FileUpload } from "@/components/ui/file-upload";`)).toEqual([{ rule: 3, text: "@/components/ui/file-upload" }]);
    expect(findPickerViolations("a.tsx", `import { x } from "../ui/file-upload";`)).toEqual([{ rule: 3, text: "../ui/file-upload" }]);
    expect(findPickerViolations("a.tsx", `import x from "react-dropzone";`)).toEqual([{ rule: 3, text: "react-dropzone" }]);
    expect(findPickerViolations("a.tsx", `import { y } from "@diceui/file-upload";`)).toEqual([{ rule: 3, text: "@diceui/file-upload" }]);
  });

  it("sees a box that asks for an image address, and leaves ordinary prose and other inputs alone", () => {
    expect(findPickerViolations("a.tsx", `<Input placeholder="Paste an image URL" />`)).toHaveLength(1);
    expect(findPickerViolations("a.tsx", `<Input placeholder="https://…/image.jpg" />`)).toHaveLength(1);
    expect(findPickerViolations("a.tsx", `<Input aria-label="Image link" />`)).toHaveLength(1);
    expect(findPickerViolations("a.tsx", `<Input placeholder="https://example.com/page" aria-label="Page address" />`)).toEqual([]);
    // a box with no placeholder is judged by its other words, and by the Field around it
    expect(findPickerViolations("a.tsx", `<Textarea rows={2} aria-label="Logo addresses" />`)).toHaveLength(1);
    expect(findPickerViolations("a.tsx", `<Input id="photo-url" name="photo-url" />`)).toHaveLength(1);
    expect(findPickerViolations("a.tsx", `<Input aria-label="Photo URL" />`)).toHaveLength(1);
    expect(findPickerViolations("a.tsx", `<Field label="Logos (1:1) — one https:// address per line"><Textarea rows={2} /></Field>`)).toHaveLength(1);
    expect(findPickerViolations("a.tsx", `<Field label={demandGen ? "Square logos — paste the link" : "Logos — one address per line"}><Textarea /></Field>`)).toHaveLength(1);
    expect(findPickerViolations("a.tsx", "<Field label={`Logos — paste up to ${max} links`}><Textarea /></Field>")).toHaveLength(1);
    expect(findPickerViolations("a.tsx", `<Field label="Business name"><Input /></Field>`)).toEqual([]);
    expect(findPickerViolations("a.tsx", `<Field label="Link (optional)"><Input placeholder="https://" /></Field>`)).toEqual([]);
    expect(findPickerViolations("a.tsx", `<Field label="Page address"><Input /></Field>`)).toEqual([]);
    expect(findPickerViolations("a.tsx", `<Input type="text" placeholder="Search by name" />`)).toEqual([]);
    expect(findPickerViolations("a.tsx", `// <input type="file" /> in a comment\nconst s = 'type="file"';`)).toEqual([]);
  });
});

describe("the one media picker", () => {
  const files = sourceFiles(SRC).filter((f) => !/media-picker-guard\.test/.test(f));
  const found = new Map<string, PickerViolation[]>();
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    if (!MAY_VIOLATE.test(src)) continue;
    const v = findPickerViolations(f, src);
    if (v.length > 0) found.set(relative(ROOT, f).replace(/\\/g, "/"), v);
  }

  it("nothing outside the allowlist opens a file chooser, imports the primitive or asks for an image link", () => {
    const stray = [...found].filter(([f]) => !ALLOWED.has(f)).map(([f, v]) => `${f}: ${v.map((x) => x.text).join(", ")}`);
    expect(stray, "use <DrivePicker destination=…/> (src/components/drive/drive-picker.tsx) instead, or add the file to ALLOWED with a reason").toEqual([]);
  });

  it("every allowlist entry still has something to allow, and names a file that exists", () => {
    const stale = [...ALLOWED.keys()].filter((f) => !found.has(f));
    expect(stale).toEqual([]);
  });

  it("the picker module is the only user of the primitive", () => {
    const users = [...found].filter(([, v]) => v.some((x) => x.rule === 3)).map(([f]) => f);
    expect(users).toEqual(["src/components/drive/drive-picker-upload.tsx"]);
  });

  it("every allowlist entry gives a reason", () => {
    for (const [f, why] of ALLOWED) expect(why.length, f).toBeGreaterThan(20);
  });
});
