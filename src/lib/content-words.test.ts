import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The Content pages' words (W1-B). These strings were product jargon on a
 * merchant's screen; a page that brings one back fails here. Scoped to the two
 * pages that carried them, because the same words are fine in code comments
 * elsewhere.
 */
const DASH = path.join(__dirname, "../app/(site)/dashboard/content");
const read = (rel: string) => readFileSync(path.join(DASH, rel), "utf8");

describe("Content page words", () => {
  const beehiiv = read("beehiiv/page.tsx");
  const sources = read("sources/page.tsx");

  it("Beehiiv names its numbers in plain words", () => {
    for (const jargon of ["Content Intelligence", "AI Tagged", "Content Readiness", "Ad-Ready", "Score 7+"]) {
      expect(beehiiv, jargon).not.toContain(jargon);
    }
    expect(beehiiv).toContain("Good for ads");
    expect(beehiiv).toContain("Rated 7 or more out of 10");
  });

  it("Sources shows no score that does not exist", () => {
    expect(sources).not.toMatch(/Coverage score/);
    expect(sources).not.toMatch(/algo in design/i);
    expect(sources).not.toMatch(/Proprietary/);
  });
});
