import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LEARNING_TABS, RULES_TABS, activeSubHref, growthNav, mandateStateOf, showFirstRun, type MandateState } from "./growth-v2-nav";

const labels = (s: MandateState) => growthNav(s).map((i) => i.label);

describe("Growth nav", () => {
  it("is the five screens in order", () => {
    expect(labels("present")).toEqual(["Growth home", "Decisions", "Channels & money", "Learning", "Rules"]);
  });

  it("points each screen at its route", () => {
    expect(growthNav("present").map((i) => i.href)).toEqual([
      "/dashboard/growth",
      "/dashboard/growth/decisions",
      "/dashboard/growth/channels",
      "/dashboard/growth/learning",
      "/dashboard/growth/rules",
    ]);
  });

  it.each<[MandateState, boolean]>([
    ["absent", true],
    ["not_built", true],
    ["present", false],
    ["unknown", false],
  ])("First run with the mandate %s: shown = %s", (state, shown) => {
    expect(showFirstRun(state)).toBe(shown);
    expect(labels(state).includes("First run")).toBe(shown);
  });

  it("puts First run last and at /start", () => {
    const nav = growthNav("absent");
    expect(nav[nav.length - 1]).toMatchObject({ label: "First run", href: "/dashboard/growth/start" });
  });

  it("carries none of the pre-v2 entries", () => {
    const all = growthNav("absent").map((i) => i.label);
    for (const gone of ["Outcomes", "Optimizer", "Ads", "Audiences", "Your Business", "Ad creatives", "Signals"]) expect(all).not.toContain(gone);
  });
});

describe("mandateStateOf", () => {
  it("reads a live result by whether it has a mandate", () => {
    expect(mandateStateOf({ preview: false, data: { mandate: { any: "thing" } } })).toBe("present");
    expect(mandateStateOf({ preview: false, data: {} })).toBe("absent");
  });

  it("calls a preview not_built even though the sample carries a mandate", () => {
    expect(mandateStateOf({ preview: true, data: { mandate: { sample: true } } })).toBe("not_built");
  });

  it("is unknown while the query has no result", () => {
    expect(mandateStateOf(undefined)).toBe("unknown");
  });
});

describe("activeSubHref", () => {
  const nav = growthNav("absent");
  const at = (p: string) => activeSubHref(p, nav);

  it("lights the screen itself", () => {
    expect(at("/dashboard/growth")).toBe("/dashboard/growth");
    expect(at("/dashboard/growth/decisions")).toBe("/dashboard/growth/decisions");
  });

  it("lights Rules, not Growth home, on the pages that became its tabs", () => {
    expect(at("/dashboard/growth/rules/audiences")).toBe("/dashboard/growth/rules");
    expect(at("/dashboard/growth/rules/audiences/abc123")).toBe("/dashboard/growth/rules");
    expect(at("/dashboard/growth/rules/business")).toBe("/dashboard/growth/rules");
  });

  it("lights Learning on Ad creatives and Signals", () => {
    expect(at("/dashboard/growth/learning/creatives")).toBe("/dashboard/growth/learning");
    expect(at("/dashboard/growth/learning/signals")).toBe("/dashboard/growth/learning");
  });

  it("lights Channels & money on campaign management", () => {
    expect(at("/dashboard/ads")).toBe("/dashboard/growth/channels");
  });

  it("does not light a sibling whose name merely starts the same", () => {
    expect(at("/dashboard/growthx")).toBeUndefined();
    expect(at("/dashboard/settings")).toBeUndefined();
  });
});

describe("the sub-tabs", () => {
  it("put the screen first and the moved pages after it", () => {
    expect(RULES_TABS.map((t) => t.label)).toEqual(["Rules", "Audiences", "Your Business"]);
    expect(LEARNING_TABS.map((t) => t.label)).toEqual(["Learning", "Ad creatives", "Signals"]);
  });

  it("light exactly one tab on each of their pages", () => {
    expect(activeSubHref("/dashboard/growth/rules", RULES_TABS)).toBe("/dashboard/growth/rules");
    expect(activeSubHref("/dashboard/growth/rules/audiences/x", RULES_TABS)).toBe("/dashboard/growth/rules/audiences");
    expect(activeSubHref("/dashboard/growth/learning/signals", LEARNING_TABS)).toBe("/dashboard/growth/learning/signals");
  });
});

// -- The deleted routes are gone ----------------------------------------------------

const SRC = path.resolve(__dirname, "..");
const DASH = path.join(SRC, "app", "(site)", "dashboard");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("the retired Outcomes and Optimizer routes", () => {
  it("have no page left", { timeout: 30_000 }, () => {
    for (const dir of ["outcomes", "optimizer"]) expect(existsSync(path.join(DASH, dir)), `dashboard/${dir}`).toBe(false);
  });

  it("are linked from nowhere in src", { timeout: 30_000 }, () => {
    // Built from parts so this file does not match itself.
    const dead = [["dashboard", "outcomes"], ["dashboard", "optimizer"]].map((parts) => `/${parts.join("/")}`);
    const hits = walk(SRC)
      .filter((f) => !f.endsWith("growth-v2-nav.test.ts"))
      .flatMap((f) => {
        const text = readFileSync(f, "utf8");
        return dead.filter((d) => text.includes(d)).map((d) => `${path.relative(SRC, f)}: ${d}`);
      });
    expect(hits).toEqual([]);
  });

  it("left no reader of the four retired growth settings", { timeout: 30_000 }, () => {
    const retired = ["optimizerEnabled", "autonomyLevel", "weeklyBudgetEnvelope", "winTarget"];
    const hits = walk(SRC)
      .filter((f) => !f.endsWith("growth-v2-nav.test.ts") && !f.includes(`${path.sep}components${path.sep}blocks${path.sep}`))
      .flatMap((f) => {
        const text = readFileSync(f, "utf8");
        return retired.filter((r) => text.includes(r)).map((r) => `${path.relative(SRC, f)}: ${r}`);
      });
    // The v2 mirror names `autonomyLevel` on the first-run plan response, which is the new contract and not the retired setting.
    expect(hits.filter((h) => !h.startsWith(path.join("lib", "api", "growth-v2.ts")) && !h.includes("growth-v2-fixtures"))).toEqual([]);
  });

  it("moved the pre-v2 pages under Rules and Learning", () => {
    const g = path.join(DASH, "growth");
    for (const rel of ["rules/audiences", "rules/business", "learning/creatives", "learning/signals"]) {
      expect(existsSync(path.join(g, rel, "page.tsx")), rel).toBe(true);
    }
    for (const rel of ["audiences", "business", "creatives", "signals"]) expect(existsSync(path.join(g, rel)), `growth/${rel}`).toBe(false);
  });
});
