import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The voice guide retired "five modules" (docs/brand/website-voice.md). No public page or component may render it.
const ROOT = path.join(__dirname, "..");
const PUBLIC_DIRS = ["app/(site)", "components/marketing", "components/shared"];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

// Strip comments so a historical note does not trip the guard; strings and JSX text are what render.
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("public copy", () => {
  it("never says five modules or 5 modules", () => {
    const hits: string[] = [];
    for (const d of PUBLIC_DIRS) {
      for (const f of walk(path.join(ROOT, d))) {
        const flat = strip(readFileSync(f, "utf8")).replace(/\s+/g, " ");
        if (/\b(five|5)[ -]modules?\b/i.test(flat)) hits.push(path.relative(ROOT, f));
      }
    }
    expect(hits).toEqual([]);
  });
});
