import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const sections = await import("./creative-sections");
const { PreviewCard, HeartButton } = await import("./preview-card");
const { TweakPanelView } = await import("./tweak-panel");

import type { FinalRow, PreviewView } from "@/lib/api/creative-studio";

const noop = () => {};
const preview = (over: Partial<PreviewView> = {}): PreviewView => ({
  id: "p1",
  index: 0,
  state: "ready",
  imageUrl: "https://x/p1.jpg",
  thumbUrl: null,
  width: 768,
  height: 960,
  headline: "Flat 20% off",
  offer: null,
  cta: null,
  productId: "prod1",
  productTitle: "Silk saree",
  safety: null,
  layoutVersion: 3,
  liked: false,
  lapsedBecause: null,
  wordingOptions: [],
  chosenOption: 0,
  canUndo: false,
  productCrop: null,
  ...over,
});
const card = (p: PreviewView, over: { canMake?: boolean; index?: number; total?: number } = {}) =>
  renderToStaticMarkup(
    <PreviewCard preview={p} index={over.index ?? 1} total={over.total ?? 4} canMake={over.canMake ?? true} onHeart={noop} onOpen={noop} onTweak={noop} onSkip={noop} />,
  );

describe("a preview card (S7)", () => {
  it("the picture has real alt text from its data, and the card says Preview", () => {
    const html = card(preview());
    expect(html).toContain('alt="Preview 2 of 4: Flat 20% off, Silk saree"');
    expect(html).toContain("Preview</");
    expect(html).toContain("<article");
  });

  it("the heart is a toggle named 'Shortlist preview {i}'", () => {
    const off = card(preview());
    expect(off).toContain('aria-label="Shortlist preview 2"');
    expect(off).toContain('aria-pressed="false"');
    const on = card(preview({ liked: true, state: "shortlisted" }));
    expect(on).toContain('aria-pressed="true"');
    // not colour alone: a filled heart and an outline on the card
    expect(on).toContain("fill-destructive");
    expect(on).toContain("outline-primary");
  });

  it("a heart a change lapsed shows outlined with 'Changed. Tap the heart again.'", () => {
    const html = card(preview({ lapsedBecause: "text" }));
    expect(html).toContain("Changed. Tap the heart again.");
    expect(html).toContain('aria-pressed="false"');
  });

  it("a viewer cannot shortlist: the heart and Tweak are off, with the reason", () => {
    const html = card(preview(), { canMake: false });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Shortlist preview 2"|<button[^>]*aria-label="Shortlist preview 2"[^>]*disabled=""/);
    expect(html).toContain("Ask an editor to shortlist.");
  });

  it("a wording the Safety check fixed says so", () => {
    expect(card(preview({ safety: { status: "fixed", note: "x" } }))).toContain("We adjusted the wording to follow the rules for your country.");
  });

  it("a final that did not match: the chip, and Try again (never a charge mentioned as made)", () => {
    const html = card(preview({ state: "final_blocked" }));
    expect(html).toContain("Didn&#x27;t match. Not charged.");
    expect(html).toContain("Try again");
    expect(html).not.toContain("Shortlist preview");
  });

  it("a preview on its way to final or ready as a final shows where it is, and no heart", () => {
    expect(card(preview({ state: "finalizing", liked: true }))).toContain("Making final");
    expect(card(preview({ state: "final_ready", liked: true }))).toContain("Final ready");
    expect(card(preview({ state: "final_failed" }))).toContain("Didn&#x27;t work. Not charged.");
  });

  it("the heart announces nothing itself: the page's live region does", () => {
    expect(renderToStaticMarkup(<HeartButton pressed label="Shortlist preview 1" onToggle={noop} />)).not.toContain("aria-live");
  });
});

describe("the grid (S6, S7)", () => {
  const grid = (previews: PreviewView[], pending = 0, canMake = true) =>
    renderToStaticMarkup(<sections.PreviewGrid previews={previews} pending={pending} canMake={canMake} onHeart={noop} onOpen={noop} onTweak={noop} onSkip={noop} />);

  it("is a list of cards, two columns on a phone and four on a large screen, never a horizontal scroller", () => {
    const html = grid([preview(), preview({ id: "p2", index: 1 })]);
    expect(html).toContain("<ul");
    expect(html).toContain("grid-cols-2");
    expect(html).toContain("lg:grid-cols-4");
    expect(html).not.toContain("overflow-x");
  });

  it("tiles still to come are skeletons that fill in; landed ones are previews", () => {
    const html = grid([preview(), preview({ id: "p2", state: "rendering" })], 2);
    expect(html.split('data-slot="studio-preview-skeleton"').length - 1).toBe(3);
    expect(html.split('data-slot="studio-preview"').length - 1).toBe(1);
  });

  it("a preview that failed says it did not work and was not charged, with no retry on the tile", () => {
    const html = grid([preview({ state: "failed" })]);
    expect(html).toContain("That one didn&#x27;t work. Not charged.");
    expect(html).not.toContain("Retry");
  });

  it("a preview the merchant put aside is not a tile; a dropped one never arrives", () => {
    expect(grid([preview({ state: "skipped" })])).not.toContain('data-slot="studio-preview"');
  });

  it("numbers previews among those that landed", () => {
    const html = grid([preview({ id: "a", state: "rendering" }), preview({ id: "b" }), preview({ id: "c" })]);
    expect(html).toContain("Preview 1 of 2");
    expect(html).toContain("Preview 2 of 2");
  });
});

describe("making, failed, all dropped, dropped line", () => {
  it("making: the count, the progress bar, how long, that the merchant can leave, and Stop", () => {
    const html = renderToStaticMarkup(<sections.MakingCard done={2} total={4} onStop={noop} />);
    expect(html).toContain("Making your previews · 2 of 4 ready");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain("This usually takes under a minute.");
    expect(html).toContain("You can leave this page. We&#x27;ll tell you when they&#x27;re ready.");
    expect(html).toContain("Stop");
  });

  it("making with no running job to stop shows no Stop", () => {
    expect(renderToStaticMarkup(<sections.MakingCard done={0} total={4} />)).not.toContain("Stop");
  });

  it("all failed: not charged, a new price first, Try again and Back to plan", () => {
    const html = renderToStaticMarkup(
      <sections.FailedCard
        quote={{ state: "quote", peaks: 680 }}
        left={5000}
        count={4}
        canMake
        pending={false}
        planHref="/dashboard/studio/new?c=c1"
        onTryAgain={noop}
        onRetryQuote={noop}
        makeLabel="Make 4 previews"
      />,
    );
    expect(html).toContain("We couldn&#x27;t make previews this time. You weren&#x27;t charged.");
    expect(html).toContain("Up to 680 Peaks for 4 previews");
    expect(html).toContain("Make 4 previews");
    expect(html).toContain("Back to plan");
    expect(html).toContain('href="/dashboard/studio/new?c=c1"');
  });

  it("all failed, price not known: Try again is off", () => {
    const html = renderToStaticMarkup(
      <sections.FailedCard quote={{ state: "unavailable" }} left={null} count={4} canMake pending={false} planHref="/x" onTryAgain={noop} onRetryQuote={noop} makeLabel="Make 4 previews" />,
    );
    expect(html).toMatch(/disabled=""[^>]*>Make 4 previews/);
  });

  it("all failed for a viewer: says to ask an editor", () => {
    const html = renderToStaticMarkup(
      <sections.FailedCard quote={{ state: "quote", peaks: 1 }} left={null} count={4} canMake={false} pending={false} planHref="/x" onTryAgain={noop} onRetryQuote={noop} makeLabel="Make 4 previews" />,
    );
    expect(html).toContain("Ask an editor to make this.");
  });

  it("all failed and refused for want of Peaks: the sentence and Add Peaks", () => {
    const html = renderToStaticMarkup(
      <sections.FailedCard
        quote={{ state: "quote", peaks: 680 }}
        left={100}
        count={4}
        canMake
        pending={false}
        refusal={{ code: "CREDITS_EXHAUSTED", tone: "error", text: "You need 680 Peaks and have 100. Nothing was started and nothing was charged.", action: "add_peaks" }}
        planHref="/x"
        onTryAgain={noop}
        onRetryQuote={noop}
        makeLabel="Make 4 previews"
      />,
    );
    expect(html).toContain("Nothing was started and nothing was charged.");
    expect(html).toContain("Add Peaks");
  });

  it("all dropped by the Safety check: not shown, not charged, the plain reasons, and Change the wording", () => {
    const html = renderToStaticMarkup(<sections.AllDroppedCard notes={["It made a health claim we can't back up in India."]} planHref="/dashboard/studio/new?c=c1" />);
    expect(html).toContain("None of these passed our Safety check, so we haven&#x27;t shown them. You weren&#x27;t charged.");
    expect(html).toContain("health claim");
    expect(html).toContain("Change the wording");
  });

  it("some dropped: one line with the count and 'Why?'; none dropped: nothing", () => {
    const html = renderToStaticMarkup(<sections.DroppedLine count={2} notes={["Why text"]} />);
    expect(html).toContain("We left out 2 that didn&#x27;t pass our Safety check.");
    expect(html).toContain("Why?");
    expect(renderToStaticMarkup(<sections.DroppedLine count={0} notes={[]} />)).toBe("");
  });

  it("earlier previews are tucked in a closed disclosure; none, nothing", () => {
    const html = renderToStaticMarkup(<sections.EarlierPreviews previews={[preview({ state: "skipped" })]} />);
    expect(html).toContain("Earlier previews (1)");
    expect(html).not.toContain(" open");
    expect(renderToStaticMarkup(<sections.EarlierPreviews previews={[]} />)).toBe("");
  });
});

describe("finals (S10): where each one is", () => {
  const f = (state: FinalRow["state"]): FinalRow => ({ id: "f1", previewId: "p1", state, width: null, height: null, match: null });
  const tile = (state: FinalRow["state"], canMake = true) =>
    renderToStaticMarkup(<sections.FinalTile final={f(state)} alt="Final: Flat 20% off, Silk saree" canMake={canMake} picture={<i data-pic="1" />} onTryAgain={noop} onTweakPreview={noop} />);

  it("a final that has not started is waiting its turn (finals from one press are made one after another)", () => {
    const html = tile("queued");
    expect(html).toContain("Waiting its turn");
    expect(html).not.toContain("Making final");
    expect(html).not.toContain("queue");
  });
  it("making, then checking it matches", () => {
    expect(tile("making")).toContain("Making final…");
    expect(tile("checking")).toContain("Checking it matches your preview…");
  });
  it("ready: the final, labelled, with its caption", () => {
    const html = tile("ready");
    expect(html).toContain("Final ready");
    expect(html).toContain("Final. Same look as your preview, only sharper.");
    expect(html).toContain("data-pic");
  });
  it("blocked by the match check: never shown, plain words, not charged, preview safe, Try again and Tweak the preview", () => {
    const html = tile("blocked");
    expect(html).toContain("We couldn&#x27;t make a final that matches this preview, so we haven&#x27;t shown it. You weren&#x27;t charged. Your preview is safe.");
    expect(html).toContain("Try again");
    expect(html).toContain("Tweak the preview");
    expect(html).not.toContain("data-pic");
  });
  it("render failed: not charged, Try again", () => {
    const html = tile("failed");
    expect(html).toContain("Something went wrong making this. You weren&#x27;t charged.");
    expect(html).toContain("Try again");
  });
  it("a viewer is not offered Try again", () => {
    expect(tile("blocked", false)).not.toContain("Try again");
  });
  it("the latest final of each preview is the one shown", () => {
    const rows: FinalRow[] = [
      { id: "new", previewId: "p1", state: "making", width: null, height: null, match: null },
      { id: "old", previewId: "p1", state: "blocked", width: null, height: null, match: null },
      { id: "other", previewId: "p2", state: "ready", width: null, height: null, match: null },
    ];
    expect(sections.latestFinals(rows).map((x) => x.id)).toEqual(["new", "other"]);
  });
});

describe("not for me", () => {
  it("the reasons are the Bible's five chips, and picking none is allowed (free)", async () => {
    const { STUDIO_COPY } = await import("@/lib/studio-copy");
    expect(STUDIO_COPY.creative.notForMeSheet.reasons).toEqual(["Wrong colours", "Wrong product shown", "Too busy", "Don't like the style", "Wording"]);
  });
});

describe("tap-to-tweak (S8)", () => {
  const quoted = { available: true, open: false, onOpen: noop, onCancel: noop, onConfirm: noop, onClearRefusal: noop, quote: { state: "loading" as const, onRetry: noop }, left: null, pending: false };
  const panel = (over: Partial<Parameters<typeof TweakPanelView>[0]> = {}) =>
    renderToStaticMarkup(
      <TweakPanelView
        preview={preview({ wordingOptions: ["Flat 20% off", "Diwali sale", "Festival offer"], chosenOption: 1, canUndo: true })}
        alt="Preview 1 of 4: Flat 20% off"
        palette={[{ key: "gold", name: "Gold", hex: "#ffd24a" }, { key: "red", name: "Deep red", hex: "#e63946" }]}
        products={[{ id: "prod1", title: "Silk saree" }, { id: "prod2", title: "Cotton scarf" }]}
        canMake
        pending={false}
        proTools={false}
        background={quoted}
        wording={quoted}
        onOp={noop}
        onColour={noop}
        {...over}
      />,
    );

  it("wording options are a radio group with the chosen one checked; Shorter and Longer are buttons", () => {
    const html = panel();
    expect(html).toContain('aria-label="Wording options"');
    expect(/aria-checked="true"[^>]*>Diwali sale</.test(html)).toBe(true);
    expect(html).toContain("Shorter");
    expect(html).toContain("Longer");
  });

  it("the headline field has a visible label and a counter against the limit of 60", () => {
    const html = panel();
    expect(html).toContain("Type your own");
    expect(html).toContain('maxLength="60"');
    expect(html).toContain("12 of 60");
  });

  it("colours are named swatches, never colour alone", () => {
    const html = panel();
    expect(html).toContain("Gold");
    expect(html).toContain("Deep red");
    expect(html).toContain('role="radio"');
  });

  it("swap product shows only with more than one product; size, position, undo, reset and the locked line are there", () => {
    expect(panel()).toContain("Cotton scarf");
    expect(panel({ products: [{ id: "prod1", title: "Silk saree" }] })).not.toContain("Cotton scarf");
    const html = panel();
    for (const t of ["Bigger", "Smaller", "Top", "Middle", "Bottom", "Undo last change", "Reset to how it first looked", "Locked: logo, legal text", "Changes are free."]) expect(html).toContain(t);
  });

  it("Undo is off when there is nothing to undo", () => {
    expect(panel({ preview: preview({ canUndo: false }) })).toMatch(/disabled=""[^>]*>Undo last change/);
  });

  it("while a change is on its way the picture is dimmed, not blank, and the controls wait", () => {
    const html = panel({ pending: true });
    expect(html).toContain("opacity-50");
    expect(html).toContain("Changing…");
    expect(html).toContain("<img");
    expect(html).toMatch(/disabled=""[^>]*>Shorter/);
  });

  it("a refusal is written in the panel and nothing is lost", () => {
    const html = panel({ error: { code: "TEXT_DOES_NOT_FIT", tone: "error", text: "That wording doesn't fit this layout. Try something shorter." } });
    expect(html).toContain('role="alert"');
    expect(html).toContain("That wording doesn&#x27;t fit this layout. Try something shorter.");
  });

  it("a viewer cannot change anything", () => {
    expect(panel({ canMake: false })).toMatch(/disabled=""[^>]*>Shorter/);
  });

  it("Try another background shows its price only once asked, and the quote is Peaks only", () => {
    const closed = panel();
    expect(closed).toContain("Try another background");
    expect(closed).not.toContain("Peaks");
    const open = panel({ background: { ...quoted, open: true, quote: { state: "quote", peaks: 170, onRetry: noop }, left: 4000 } });
    expect(open).toContain("Uses 170 Peaks");
    expect(open).toContain("4,000 left this month");
    expect(open).toContain("Make it · 170 Peaks");
  });

  it("another background that is not available yet is off with 'Coming soon', and no price", () => {
    const html = panel({ background: { ...quoted, available: false } });
    expect(html).toMatch(/disabled=""[^>]*>Try another background/);
    expect(html).toContain("Coming soon");
    expect(html).not.toContain("Peaks");
  });

  it("Write new wording is a Pro tools control", () => {
    expect(panel()).not.toContain("Write new wording");
    expect(panel({ proTools: true })).toContain("Write new wording");
  });
});
