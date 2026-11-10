import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Every Radix TabsTrigger gets `aria-controls` pointing at its panel id. A
 * trigger value with no TabsContent (and no TabPanelStubs) in the same file
 * leaves a dangling id: axe `aria-valid-attr-value`. This scans src for it.
 */
const SRC = path.resolve(__dirname, "../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "node_modules") continue;
      walk(full, out);
    } else if (name.endsWith(".tsx") && !name.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

/** Files whose dynamic triggers are covered by literal panels (reason required). */
const ALLOWLIST: Record<string, string> = {
  // Triggers come from DRIVE_TABS (files, brand, cleanup, trash, storage) and
  // the page renders a literal TabsContent for each of those five ids.
  "app/(site)/dashboard/drive/page.tsx": "every DRIVE_TABS id has a literal TabsContent",
};

function triggerValues(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/<TabsTrigger\b[^>]*?\bvalue=(?:"([^"]+)"|\{([^}]+)\})/g)) {
    out.push(m[1] ?? `{${m[2]}}`);
  }
  return out;
}

function panelValues(src: string): Set<string> {
  const out = new Set<string>();
  for (const m of src.matchAll(/<TabsContent\b[^>]*?\bvalue=(?:"([^"]+)"|\{([^}]+)\})/g)) {
    out.add(m[1] ?? `{${m[2]}}`);
  }
  // <TabPanelStubs values={[...]} /> covers whatever it is handed; a literal
  // list must name each trigger, a computed one covers dynamic triggers.
  for (const m of src.matchAll(/<TabPanelStubs\b[^>]*?values=\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g)) {
    out.add("STUBS");
    for (const lit of m[1].matchAll(/"([^"]+)"/g)) out.add(lit[1]);
  }
  return out;
}

describe("Tabs triggers have panels", () => {
  const files = walk(SRC).filter((f) => !f.includes(`${path.sep}components${path.sep}ui${path.sep}`));
  const withTriggers = files.filter((f) => readFileSync(f, "utf8").includes("<TabsTrigger"));

  it("finds the Tabs usages", () => {
    expect(withTriggers.length).toBeGreaterThan(5);
  });

  for (const file of withTriggers) {
    const rel = path.relative(SRC, file).split(path.sep).join("/");
    if (ALLOWLIST[rel]) continue;
    it(rel, () => {
      const src = readFileSync(file, "utf8");
      const panels = panelValues(src);
      const dynamicPanel = [...panels].some((p) => p === "STUBS" || p.startsWith("{"));
      const missing = triggerValues(src).filter(
        (v) => !panels.has(v) && !dynamicPanel,
      );
      expect(missing, `TabsTrigger value(s) with no TabsContent/TabPanelStubs in ${rel}`).toEqual([]);
    });
  }
});
