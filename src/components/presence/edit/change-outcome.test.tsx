import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { presenceEditKeys } from "@/lib/presence-edit";

/**
 * The line under a live change card (PE-13) with the api's answer in the cache. WHAT THIS CANNOT PROVE: a browser (static markup, no effect
 * runs), the api (every answer is a fixture), or that the request is made only for a live change (the hook's `enabled`, not rendered here).
 */

vi.mock("@/lib/api", () => ({ api: { get: async () => { throw new Error("no network in this test"); } } }));
const { ChangeOutcome } = await import("@/components/presence/edit/change-outcome");

function render(live: boolean, answer: unknown) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  if (answer !== undefined) qc.setQueryData(presenceEditKeys.outcome("c1"), answer);
  return renderToStaticMarkup(createElement(QueryClientProvider, { client: qc }, createElement(ChangeOutcome, { changeId: "c1", live })));
}

const measured = {
  label: "NetA",
  outcome: {
    status: "measured",
    reason: "compared",
    message: "Here is what followed this change: the 28 days before (12 Sep to 9 Oct) against the 28 days after (11 Oct to 7 Nov). Figures are from NetA.",
    lines: [{ metric: "calls", state: "compared", direction: "higher", text: "Calls: 40 in the 28 days before, 60 in the 28 days after (higher)." }],
  },
};

describe("the outcome under a live change", () => {
  it("shows the dated comparison and each figure", () => {
    const html = render(true, measured);
    expect(html).toContain("What followed this change");
    expect(html).toContain("12 Sep to 9 Oct");
    expect(html).toContain("Calls: 40 in the 28 days before, 60 in the 28 days after (higher).");
    expect(html).toContain("Figures are from NetA.");
  });

  it("a state that is not a comparison shows its sentence and no figures", () => {
    const html = render(true, { label: "NetA", outcome: { status: "too_early", reason: "window_not_finished", message: "Too early to tell. Check back from 8 Nov.", lines: [{ metric: "calls", state: "compared", direction: "higher", text: "Calls: 1 in the 28 days before" }] } });
    expect(html).toContain("Too early to tell");
    expect(html).toContain("Check back from 8 Nov.");
    expect(html).not.toContain("Calls:");
  });

  it("draws nothing for a network with no figures, nothing to say, no answer yet, or a change that is not live", () => {
    expect(render(true, { outcome: null, label: null })).toBe("");
    expect(render(true, { label: "NetA", outcome: { status: "none", reason: "not_live", message: "x", lines: [] } })).toBe("");
    expect(render(true, undefined)).toBe("");
    expect(render(false, measured)).toBe("");
  });
});
