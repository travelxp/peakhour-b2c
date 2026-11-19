import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { MakeFinalBarView, MakeFinalSheetView } = await import("./make-final");
const { ShortlistView, groupByCreative } = await import("./shortlist-screen");
const { QuoteBlock } = await import("./studio-quote");

import type { ShortlistItem, ShortlistResponse } from "@/lib/api/creative-studio";

const noop = () => {};
const item = (over: Partial<ShortlistItem> = {}): ShortlistItem => ({
  creativeId: "c1",
  previewId: "p1",
  state: "shortlisted",
  headline: "Flat 20% off",
  productTitle: "Silk saree",
  thumbUrl: "https://x/t.jpg",
  likedAt: "2026-11-18T00:00:00.000Z",
  lapsed: false,
  waitingLong: false,
  ...over,
});

describe("the Make final bar (S9)", () => {
  const bar = (over: Partial<Parameters<typeof MakeFinalBarView>[0]> = {}) =>
    renderToStaticMarkup(<MakeFinalBarView count={3} final="on" quote={{ state: "quote", peaks: 1200 }} canMake onMake={noop} {...over} />);

  it("'{n} shortlisted' links to the Shortlist, with the price, the help and Make final", () => {
    const html = bar();
    expect(html).toContain("3 shortlisted");
    expect(html).toContain('href="/dashboard/studio/shortlist"');
    expect(html).toContain("1,200 Peaks");
    expect(html).toContain('aria-label="Why these sizes?"');
    expect(html).toContain("Make final");
    expect(html).not.toMatch(/disabled=""[^>]*>Make final/);
  });

  it("a region named Make final, above the tab bar on a phone", () => {
    const html = bar();
    expect(html).toContain('role="region"');
    expect(html).toContain("bottom-[calc(56px+env(safe-area-inset-bottom))]");
  });

  it("while the price is being asked, polite text and no figure", () => {
    const html = bar({ quote: { state: "loading" } });
    expect(html).toContain("Working out what this costs…");
    expect(html).not.toContain("Peaks");
  });

  it("price unavailable says so", () => {
    expect(bar({ quote: { state: "unavailable" } })).toContain("We can&#x27;t work out the price right now.");
  });

  it("final not available yet: the count stays, the button reads 'Final opens soon' (off), and there is no price and no help", () => {
    const html = bar({ final: "coming_soon" });
    expect(html).toContain("3 shortlisted");
    expect(html).toMatch(/disabled=""[^>]*>Final opens soon/);
    expect(html).not.toContain("Peaks");
    expect(html).not.toContain("Why these sizes?");
  });

  it("a viewer cannot make final: off, with the line", () => {
    const html = bar({ canMake: false });
    expect(html).toMatch(/disabled=""[^>]*>Make final/);
    expect(html).toContain("Ask an editor to make this.");
  });

  it("free work says Free", () => {
    expect(bar({ quote: { state: "quote", peaks: 0, free: true } })).toContain("Free");
  });
});

describe("the choose sheet (S9, S10)", () => {
  const sheet = (over: Partial<Parameters<typeof MakeFinalSheetView>[0]> = {}) =>
    renderToStaticMarkup(
      <MakeFinalSheetView
        items={[item(), item({ previewId: "p2", headline: "Diwali sale" })]}
        selected={new Set(["p1", "p2"])}
        onToggle={noop}
        final="on"
        quote={{ state: "quote", peaks: 800 }}
        left={5000}
        pending={false}
        onConfirm={noop}
        onCancel={noop}
        onClearRefusal={noop}
        {...over}
      />,
    );

  it("lists each shortlisted preview, ticked, with its headline and product", () => {
    const html = sheet();
    expect(html).toContain("Flat 20% off");
    expect(html).toContain("Diwali sale");
    expect(html).toContain("Silk saree");
    expect(html.split('aria-checked="true"').length - 1).toBe(2);
  });

  it("the price is for the ticked count: 'Uses N Peaks for 2 finals', what is left, charged only if it works, the help, and the confirm", () => {
    const html = sheet();
    expect(html).toContain("Uses 800 Peaks for 2 finals");
    expect(html).toContain("5,000 left this month");
    expect(html).toContain("Charged only if it works.");
    expect(html).toContain("Why these sizes?");
    expect(html).toContain("Make final · 800 Peaks");
  });

  it("one ticked says 'final' not 'finals'", () => {
    expect(sheet({ selected: new Set(["p1"]), quote: { state: "quote", peaks: 400 } })).toContain("Uses 400 Peaks for 1 final");
  });

  it("nothing ticked: the confirm is off and says to choose one", () => {
    const html = sheet({ selected: new Set() });
    expect(html).toContain("Choose at least one preview.");
    expect(html).toMatch(/disabled=""[^>]*>Make final</);
  });

  it("an unticked preview is left out of the count", () => {
    const html = sheet({ selected: new Set(["p2"]) });
    expect(html.split('aria-checked="true"').length - 1).toBe(1);
  });

  it("the price is being asked or cannot be worked out: the confirm is off", () => {
    expect(sheet({ quote: { state: "loading" } })).toMatch(/disabled=""[^>]*>Make final</);
    const un = sheet({ quote: { state: "unavailable" } });
    expect(un).toContain("We can&#x27;t work out the price right now.");
    expect(un).toMatch(/disabled=""[^>]*>Make final</);
  });

  it("not enough Peaks: the api's sentence, Add Peaks, and 'Make 2 finals instead' when the balance covers some", () => {
    const html = sheet({
      refusal: { code: "CREDITS_EXHAUSTED", tone: "error", text: "You need 800 Peaks and have 450. Nothing was started and nothing was charged.", action: "add_peaks" },
      makeInstead: { label: "Make 1 final instead", onPress: noop },
    });
    expect(html).toContain("You need 800 Peaks and have 450. Nothing was started and nothing was charged.");
    expect(html).toContain("Add Peaks");
    expect(html).toContain("Make 1 final instead");
  });

  it("the Peaks ran short part way: how many were started and that the rest were not", () => {
    expect(sheet({ startedShort: 1 })).toContain("Your Peaks cover 1 of these. The rest were not started.");
  });

  it("while pressing, the confirm is off (one click, one charge)", () => {
    expect(sheet({ pending: true })).toMatch(/disabled=""[^>]*>Make final · 800 Peaks/);
  });

  it("switched off while the sheet was open: the designed card, no price, no error", () => {
    const html = sheet({ final: "off" });
    expect(html).toContain("Making a final isn&#x27;t available yet. You weren&#x27;t charged.");
    expect(html).toContain("Coming soon");
    expect(html).not.toContain("Peaks for");
    expect(html).not.toContain('role="alert"');
  });

  it("states the contract: made from the exact preview, a mismatch is not shown and not charged (the sheet description)", async () => {
    const { STUDIO_COPY } = await import("@/lib/studio-copy");
    expect(STUDIO_COPY.shortlist.chooseDescription).toContain("exact preview");
    expect(STUDIO_COPY.shortlist.chooseDescription).toContain("you won't be charged");
  });
});

describe("the quote block never shows a currency symbol", () => {
  it.each([["previews"], ["finals"], ["total"]] as const)("%s", (kind) => {
    const html = renderToStaticMarkup(<QuoteBlock state="quote" kind={kind} peaks={1234} units={3} left={99_999} help />);
    expect(html).not.toMatch(/[₹£$€]/);
    expect(html).toContain("1,234 Peaks");
  });
});

describe("the Shortlist page (S9)", () => {
  const view = (status: Parameters<typeof ShortlistView>[0]["status"], data?: ShortlistResponse, canMake = true) =>
    renderToStaticMarkup(<ShortlistView status={status} data={data} canMake={canMake} onRetry={noop} onRemove={noop} />);

  it("loading: skeletons, no empty state, no error", () => {
    const html = view("loading");
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("Nothing shortlisted yet");
  });

  it("an error is an error with Retry, never an empty list", () => {
    const html = view("error");
    expect(html).toContain("Retry");
    expect(html).not.toContain("Nothing shortlisted yet");
  });

  it("offline says so and has no retry", () => {
    const html = view("offline");
    expect(html).toContain("offline");
    expect(html).not.toContain("Retry");
  });

  it("empty: the designed empty state with the spec's words", () => {
    const html = view("ready", { items: [], count: 0 });
    expect(html).toContain("Nothing shortlisted yet");
    expect(html).toContain("Tap the heart on a preview you like. It waits here until you make it final.");
    expect(html).toContain('href="/dashboard/studio"');
  });

  it("rows: thumbnail, headline, product, state chip, Open and Remove", () => {
    const html = view("ready", { items: [item()], count: 1 });
    expect(html).toContain("Flat 20% off");
    expect(html).toContain("Silk saree");
    expect(html).toContain("Waiting");
    expect(html).toContain('href="/dashboard/studio/c/c1"');
    expect(html).toContain("Remove from shortlist");
  });

  it("every state has its chip", () => {
    const states: Array<[Partial<ShortlistItem>, string]> = [
      [{ state: "finalizing" }, "Making final"],
      [{ state: "final_ready" }, "Final ready"],
      [{ state: "final_blocked" }, "Didn&#x27;t match. Not charged."],
      [{ state: "final_failed" }, "Didn&#x27;t work. Not charged."],
      [{ state: "ready", lapsed: true }, "Changed. Tap the heart again."],
    ];
    for (const [over, text] of states) expect(view("ready", { items: [item(over)], count: 1 })).toContain(text);
  });

  it("only a waiting preview can be removed; a viewer cannot remove", () => {
    expect(view("ready", { items: [item({ state: "finalizing" })], count: 1 })).not.toContain("Remove from shortlist");
    expect(view("ready", { items: [item()], count: 1 }, false)).not.toContain("Remove from shortlist");
  });

  it("the reminder line appears once something has waited more than three days", () => {
    expect(view("ready", { items: [item()], count: 1 })).not.toContain("These have been waiting a while.");
    expect(view("ready", { items: [item({ waitingLong: true })], count: 1 })).toContain("These have been waiting a while. Make them final or remove them.");
  });

  it("rows are grouped by creative", () => {
    const g = groupByCreative([item(), item({ previewId: "p2" }), item({ creativeId: "c2", previewId: "p3" })]);
    expect(g.map((x) => [x.creativeId, x.items.length])).toEqual([["c1", 2], ["c2", 1]]);
  });
});
