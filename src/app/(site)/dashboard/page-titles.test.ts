import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PILLAR_COPY, SUB_COPY } from "@/lib/nav-copy";

/**
 * A merchant clicks "Publishing calendar" in the nav and lands on a page titled
 * "Content Calendar": two names for one place. For every dashboard route that
 * has a nav-copy entry, the page's title literal (PageHeader `title="..."` or
 * the first `<h1>` text) must equal the nav label, unless the route is listed
 * below with the reason it differs. A title built from an expression (e.g.
 * `title={navLabel(...)}`) is not a literal and is skipped: it cannot drift.
 */
const DASHBOARD = __dirname;

/** route -> why the page title is allowed to differ from its nav label. */
const ALLOWLIST: Record<string, string> = {};

function pageTitleLiteral(src: string): string | null {
  const header = src.match(/<PageHeader\b[^>]*?\btitle=(?:"([^"]+)"|\{"([^"]+)"\})/);
  if (header) return header[1] ?? header[2];
  const h1 = src.match(/<h1(?:\s[^>]*)?>\s*([^<{][^<{]*?)\s*<\/h1>/);
  return h1 ? h1[1].replace(/\s+/g, " ") : null;
}

describe("dashboard page titles match the nav", () => {
  const routes = [...Object.keys(PILLAR_COPY), ...Object.keys(SUB_COPY)];
  const seen = new Set<string>();
  for (const route of routes) {
    if (seen.has(route)) continue;
    seen.add(route);
    const file = path.join(DASHBOARD, route.replace("/dashboard", ""), "page.tsx");
    if (!existsSync(file)) continue;
    const label = (SUB_COPY[route] ?? PILLAR_COPY[route]).label;
    const title = pageTitleLiteral(readFileSync(file, "utf8"));
    if (title === null) continue;
    it(`${route}: "${title}" vs nav "${label}"`, () => {
      if (ALLOWLIST[route]) {
        expect(ALLOWLIST[route].length).toBeGreaterThan(10);
        return;
      }
      expect(title).toBe(label);
    });
  }

  it("the ideas sub-page of the calendar takes its title from the calendar's nav label", () => {
    // /dashboard/calendar/ideas has no nav entry of its own; it is the same
    // Publishing calendar, so it must not invent a second name for it.
    const src = readFileSync(path.join(DASHBOARD, "calendar/ideas/page.tsx"), "utf8");
    expect(src).toContain('title={navLabel("/dashboard/calendar")}');
    expect(src).not.toContain('title="Content Calendar"');
  });

  it("checks at least some routes", () => {
    expect(seen.size).toBeGreaterThan(20);
  });
});
