import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * C8 (2026-11-04): what a merchant reads about WhatsApp results. One rule across Peakhour: AI credits are for a task Peakhour does,
 * never for a result it claims credit for, so no screen may say a result is billed, and none may show a price beside one.
 *
 * The pages are read as text (they are client components with no unit seam); the exact new sentences are pinned, and the old
 * ones are asserted ABSENT on text flattened to one line (the files wrap).
 */

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8").replace(/\s+/g, " ");
const ANALYTICS = read("../../../../../components/inbox/support-results-panel.tsx");
const HUB = read("./page.tsx");
const HOOK = read("../../../../../hooks/use-wa-analytics.ts");
const PEAKS = read("../../peaks/page.tsx");
const LINKEDIN = read("../../ads/_components/linkedin-ads-panel.tsx");

describe("the WhatsApp results page", () => {
  it("says the figures are for information and that credits are for the assistant's work, not for these results", () => {
    expect(ANALYTICS).toContain("What the assistant reached, last {outcomes.data?.windowDays ?? 30} days");
    expect(ANALYTICS).toContain(
      "What your WhatsApp assistant reached. These are counts for your information. AI credits are used for the work the assistant does, such as each reply, not for these results.",
    );
  });

  it("shows the two counts, and no AI credits figure and no breakdown by product", () => {
    expect(ANALYTICS).toContain('title="Resolved conversations"');
    expect(ANALYTICS).toContain('title="Orders the assistant helped with"');
    expect(ANALYTICS).not.toContain("AI credits spent");
    expect(ANALYTICS).not.toContain("Outcomes by product");
    expect(ANALYTICS).not.toContain("totalPeaks");
    expect(ANALYTICS).not.toContain("byPillar");
    expect(ANALYTICS).not.toContain("<Peaks");
  });

  it("★never says a result is billed", () => {
    for (const old of ["billed on outcomes", "Billed outcomes", "billable outcomes", "You’re billed"]) {
      expect(ANALYTICS, old).not.toContain(old);
      expect(HUB, old).not.toContain(old);
    }
  });

  it("never names the retired billing cron", () => {
    expect(ANALYTICS).not.toContain("wa-outcome-billing");
  });
});

describe("the WhatsApp hub card", () => {
  it("is called Results and describes figures, not a bill", () => {
    expect(HUB).toContain('<h2 className="text-sm font-medium">Results</h2>');
    expect(HUB).toContain("Support results, resolved conversations, and orders your assistant helped with. These are figures for your information.");
    expect(HUB).not.toContain("AI credits spent");
  });
});

describe("the results type", () => {
  it("carries counts only", () => {
    expect(HOOK).toContain("resolved: { count: number }; assisted: { count: number };");
    expect(HOOK).not.toMatch(/peaks/i);
  });
});

describe("the rate card sentence", () => {
  it("no longer speaks of an outcome that is charged each time it happens", () => {
    expect(PEAKS).toContain("The Peaks each task costs when it runs — or, for a task that happens as an event (a boost, an X message), each time it happens.");
    expect(PEAKS).not.toContain("or, for an outcome, each time it happens");
  });
});

describe("the LinkedIn qualified-lead column", () => {
  it("calls them qualified leads, not billable ones", () => {
    expect(LINKEDIN).toContain('title="Qualified leads · cost per qualified lead (spend ÷ qualified leads)"');
    expect(LINKEDIN).not.toContain("Billable qualified leads");
  });
});

