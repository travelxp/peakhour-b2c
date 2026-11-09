import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import ts from "typescript";

/**
 * The Presence screens name no network (PE-EC). The rule lives here, where the screens live: a network's name, its label and what it can do
 * arrive from the api's adapter declarations, so adding a network changes no screen. (peakhour-api's `lint:presence-engine` holds the same
 * rule for the api side and can scan this folder too.)
 *
 * ★THE COMPILER'S OWN SCANNER, NOT A HAND-ROLLED COMMENT STRIPPER: identifiers, string and template literals and JSX text are checked,
 * comments never are, so a docblock may still say why a rule exists. Names are compared as WORDS (split on case and on `_ - $`), so
 * `googleReview`, `google_review` and `GBP` match while `binding` does not. The word list mirrors the api lint's; add a network to both.
 */

const NETWORK_WORDS: ReadonlySet<string> = new Set([
  "google", "tiktok", "twitter", "gbp", "yelp", "bing", "apple", "facebook", "instagram", "linkedin", "foursquare", "tripadvisor",
  "trustpilot", "yellowpages", "justdial", "nextdoor", "whatsapp",
]);

function wordsOf(token: string): string[] {
  return token
    .split(/[_$-]+/)
    .flatMap((part) => part.match(/[A-Z]{2,}(?![a-z])|[A-Z]?[a-z]+|\d+/g) ?? [])
    .map((w) => w.toLowerCase());
}

function namesIn(token: string): string[] {
  const w = wordsOf(token);
  const found = new Set<string>();
  for (let i = 0; i < w.length; i++) {
    for (let n = 1; n <= 3 && i + n <= w.length; n++) {
      const run = w.slice(i, i + n).join("");
      if (NETWORK_WORDS.has(run)) found.add(run);
    }
  }
  // `meta` is an ordinary word on its own and a company inside a longer name
  if (w.includes("meta") && token !== "meta") found.add("meta");
  return [...found];
}

/** Network names in the code, string literals and JSX text of one source file (comments are not tokens). */
export function networkNamesIn(file: string, src: string): string[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: string[] = [];
  const visit = (node: ts.Node) => {
    let text: string | undefined;
    if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) text = node.text;
    else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) text = node.text;
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) text = node.text;
    else if (ts.isJsxText(node)) text = node.text;
    if (text) for (const token of text.match(/[A-Za-z0-9_$-]+/g) ?? []) out.push(...namesIn(token));
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

const SRC = resolve(__dirname, "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

/** The files that draw Presence: the components folder, the page, the api client, the lib helpers and the hooks. */
function presenceFiles(): string[] {
  const byPrefix = (dir: string, prefix: string) =>
    readdirSync(join(SRC, dir))
      .filter((n) => n.startsWith(prefix) && /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n))
      .map((n) => join(SRC, dir, n));
  return [
    ...walk(join(SRC, "components", "presence")),
    ...walk(join(SRC, "app", "(site)", "dashboard", "presence")),
    ...byPrefix(join("lib", "api"), "presence"),
    ...byPrefix("lib", "presence-"),
    ...byPrefix("hooks", "use-presence"),
  ].sort();
}

describe("networkNamesIn (the rule itself)", () => {
  const names = (src: string, file = "x.tsx") => networkNamesIn(file, src);
  it("catches a name in a string, an identifier, a template and JSX text", () => {
    expect(names(`const a = "google_review";`)).toEqual(["google"]);
    expect(names(`function readGoogleReply() {}`)).toEqual(["google"]);
    expect(names("const s = `${x}:yelp:sync`;")).toEqual(["yelp"]);
    expect(names(`export const C = () => <h2>Google Business Profile</h2>;`)).toEqual(["google"]);
    expect(names(`type GBPReview = {};`)).toEqual(["gbp"]);
    expect(names("const a = WhatsApp; const b = TikTok;")).toEqual(["whatsapp", "tiktok"]);
  });
  it("does not fire on a comment, a JSX comment, or a longer word that contains a name", () => {
    expect(names(`// google says so\
/** and gbp too */\
const a = 1;`)).toEqual([]);
    expect(names(`export const C = () => <div>{/* Google */}ok</div>;`)).toEqual([]);
    expect(names(`const binding = 1; const pineapple = 2; const bingo = 3; const meta = 4;`)).toEqual([]);
    expect(names(`const metaAds = 1;`)).toEqual(["meta"]);
  });
  it("reads a JSX text with an apostrophe without losing the rest of the file", () => {
    expect(names(`const C = () => <p>It isn't there</p>;\
const g = "yelp";`)).toEqual(["yelp"]);
  });
});

describe("the Presence screens name no network", () => {
  const files = presenceFiles();
  it("finds the screens it is meant to guard", () => {
    const rel = files.map((f) => f.slice(SRC.length + 1).split("\\").join("/"));
    expect(rel).toContain("components/presence/presence-home.tsx");
    expect(rel).toContain("components/presence/network-connect-card.tsx");
    expect(rel).toContain("lib/presence-panels.ts");
    expect(rel).toContain("lib/api/presence.ts");
    expect(rel).toContain("hooks/use-presence-listing.ts");
    expect(files.length).toBeGreaterThan(20);
  });
  it.each(files.map((f) => [f.slice(SRC.length + 1).split("\\").join("/"), f] as const))("%s", (_rel, full) => {
    expect(networkNamesIn(full, readFileSync(full, "utf-8"))).toEqual([]);
  });
});
