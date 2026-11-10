import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { PAGE_INTRO_COPY } from "@/lib/page-intro-copy";
import { NOT_FOUND_DESTINATIONS } from "@/lib/dashboard-not-found";

const DASH = __dirname;
const pillars = readdirSync(DASH).filter((n) => statSync(path.join(DASH, n)).isDirectory());

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (n.endsWith(".tsx")) out.push(p);
  }
  return out;
}

describe("dashboard error and not-found boundaries", () => {
  it("finds the pillar folders", () => {
    expect(pillars.length).toBeGreaterThanOrEqual(17);
  });

  it.each(pillars)("pillar %s has its own error.tsx", (pillar) => {
    expect(existsSync(path.join(DASH, pillar, "error.tsx"))).toBe(true);
  });

  it.each(pillars)("pillar %s error.tsx is a client boundary with a default export", (pillar) => {
    const src = readFileSync(path.join(DASH, pillar, "error.tsx"), "utf8");
    expect(src.trimStart().startsWith('"use client"')).toBe(true);
    expect(src).toMatch(/export default function/);
  });

  it("the dashboard has a not-found that offers five destinations", () => {
    expect(existsSync(path.join(DASH, "not-found.tsx"))).toBe(true);
    expect(NOT_FOUND_DESTINATIONS).toHaveLength(5);
    for (const d of NOT_FOUND_DESTINATIONS) {
      const dir = d.href.replace("/dashboard/", "");
      expect(existsSync(path.join(DASH, dir, "page.tsx")), d.href).toBe(true);
    }
  });
});

describe("page intro strips", () => {
  const files = walk(DASH).filter((f) => !f.endsWith(".test.tsx"));
  const used = new Set<string>();
  for (const f of files) {
    for (const m of readFileSync(f, "utf8").matchAll(/<PageIntro id="([^"]+)"/g)) used.add(m[1]);
  }

  it("covers the ten pages (Autopilot on both its pages), each id used by a page", () => {
    expect([...used].sort()).toEqual(Object.keys(PAGE_INTRO_COPY).sort());
  });

  it("is written without product jargon", () => {
    const banned = /\b(api|sla|webhook|algorithm|token|ctr|roas|mandate|guardrail|embedding|llm|pipeline|schema|oauth)\b/i;
    for (const [id, c] of Object.entries(PAGE_INTRO_COPY)) {
      expect(`${c.title} ${c.body} ${c.next}`, id).not.toMatch(banned);
    }
  });
});
