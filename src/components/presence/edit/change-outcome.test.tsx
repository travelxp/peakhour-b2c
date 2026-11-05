import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChangeOutcome } from "@/components/presence/edit/change-outcome";

/**
 * The line under a live change card (PE-13), drawn from the answer the list owner passes in. WHAT THIS CANNOT PROVE: a browser (static
 * markup), the api (every answer is a fixture), or that the list owners pass the right answer to each card (change-outcome-wiring.test.ts
 * reads their source for that, which is a string check and not a render).
 */

const render = (outcome: unknown) => renderToStaticMarkup(createElement(ChangeOutcome, { outcome: outcome as never }));
const count = (html: string, s: string) => html.split(s).length - 1;

const measured = {
  id: "c1",
  outcome: {
    status: "measured",
    reason: "compared",
    message: "The 28 days before (12 Sep to 9 Oct) against the 28 days after (11 Oct to 7 Nov). Figures are from NetA.",
    lines: [{ text: "Calls: 40 in the 28 days before, 60 in the 28 days after (higher)." }],
  },
};

describe("the outcome under a live change", () => {
  it("shows the headline once, the dated comparison and each figure", () => {
    const html = render(measured);
    expect(count(html, "What followed this change")).toBe(1);
    expect(html).toContain("12 Sep to 9 Oct");
    expect(html).toContain("Calls: 40 in the 28 days before, 60 in the 28 days after (higher).");
    expect(html).toContain("Figures are from NetA.");
  });

  it("a state that is not a comparison shows its headline once, its sentence and no figures", () => {
    const html = render({
      id: "c1",
      outcome: { status: "too_early", reason: "window_not_finished", message: "The 28 days after this change run to 7 Nov. Check back from 8 Nov.", lines: [{ text: "Calls: 1 in the 28 days before" }] },
    });
    expect(count(html, "Too early to tell")).toBe(1);
    expect(html).toContain("Check back from 8 Nov.");
    expect(html).not.toContain("Calls:");
  });

  it("a finished stretch with too few is not called early", () => {
    const html = render({ id: "c1", outcome: { status: "too_few", reason: "too_few_actions", message: "There were fewer than 10 calls in all.", lines: [] } });
    expect(html).toContain("Too few to compare");
    expect(html).not.toMatch(/too early/i);
  });

  it("draws nothing without an answer, for a status that says nothing, or for a reason it has no words for", () => {
    expect(render(null)).toBe("");
    expect(render(undefined)).toBe("");
    expect(render({ id: "c1", outcome: { status: "none", reason: "not_live", message: "x", lines: [] } })).toBe("");
    expect(render({ id: "c1", outcome: { status: "novel", reason: "from_a_newer_api", message: "x", lines: [] } })).toBe("");
  });
});
