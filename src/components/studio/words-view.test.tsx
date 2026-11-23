import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { WordsView, WordsCardView } = await import("./words-view");

import type { WordsViewProps } from "./words-view";
import type { PreviewView } from "@/lib/api/creative-studio";

const noop = () => {};
const card = (over: Partial<PreviewView> = {}): PreviewView =>
  ({
    id: "p1",
    index: 0,
    state: "ready",
    imageUrl: null,
    thumbUrl: null,
    width: null,
    height: null,
    headline: "Festive silk, flat 20% off",
    offer: null,
    cta: "Shop now",
    productId: "prod1",
    productTitle: "Silk saree",
    safety: { status: "passed" },
    layoutVersion: 0,
    liked: false,
    lapsedBecause: null,
    wordingOptions: [],
    chosenOption: 0,
    canUndo: false,
    productCrop: null,
    headlineBackdrop: null,
    words: { headline: "Festive silk, flat 20% off", primaryText: "Pure silk sarees for your Diwali.", description: "See the range", cta: "Shop now", hashtags: ["SilkSaree", "Diwali"] },
    ...over,
  }) as PreviewView;

const base = (over: Partial<WordsViewProps> = {}): WordsViewProps => ({
  phase: "ready",
  cards: [card(), card({ id: "p2", index: 1, liked: true, state: "shortlisted" })],
  pending: 0,
  progress: { done: 2, total: 2 },
  canMake: true,
  droppedCount: 0,
  droppedNotes: [],
  quote: { state: "quote", peaks: 50, onRetry: noop },
  left: 5200,
  notReleased: false,
  starting: false,
  planHref: "/dashboard/studio/new?c=abc",
  onHeart: noop,
  onSkip: noop,
  onUse: noop,
  onWrite: noop,
  onRequote: noop,
  ...over,
});
const render = (over: Partial<WordsViewProps> = {}) => renderToStaticMarkup(<WordsView {...base(over)} />);

describe("words only (S20): the option cards", () => {
  it("draws each card with headline, main text, description, button and hashtags, and says options, never previews", () => {
    const html = render();
    for (const t of ["Festive silk, flat 20% off", "Pure silk sarees for your Diwali.", "See the range", "Shop now", "#SilkSaree #Diwali", "Option 1 of 2", "Option 2 of 2"]) expect(html).toContain(t);
    expect(html).toContain("Options. Not used yet.");
    expect(html.split("Shortlisted previews").join("")).not.toMatch(/preview/i);
    expect(html).toContain("Made with AI. Some channels ask you to say so.");
  });

  it("the heart is a toggle named for the option, and 'Use these words' waits for the heart", () => {
    const html = render();
    expect(html).toContain('aria-label="Shortlist option 1"');
    expect(/aria-pressed="true"[^>]*aria-label="Shortlist option 2"|aria-label="Shortlist option 2"[^>]*aria-pressed="true"/.test(html)).toBe(true);
    const first = renderToStaticMarkup(<WordsCardView preview={card()} index={0} total={2} canMake onHeart={noop} onSkip={noop} onUse={noop} />);
    expect(/<button[^>]*disabled=""[^>]*>Use these words</.test(first)).toBe(true);
    const second = renderToStaticMarkup(<WordsCardView preview={card({ liked: true, state: "shortlisted" })} index={0} total={2} canMake onHeart={noop} onSkip={noop} onUse={noop} />);
    expect(/<button[^>]*disabled=""[^>]*>Use these words</.test(second)).toBe(false);
  });

  it("a viewer cannot heart, use or skip, and is told to ask an editor", () => {
    const html = render({ canMake: false });
    expect(html).toContain("Ask an editor to make this.");
    expect((html.match(/disabled=""/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it("a card the Safety check reworded says so; one with no description or hashtags leaves those rows out", () => {
    const html = render({ cards: [card({ safety: { status: "fixed", note: "We adjusted the wording to follow IN rules." }, words: { headline: "H", primaryText: "T", description: null, cta: null, hashtags: [] } })] });
    expect(html).toContain("We adjusted the wording to follow IN rules.");
    expect(html).not.toContain("Description");
    expect(html).not.toContain("Hashtags");
  });
});

describe("words only: the price and the states", () => {
  it("asks for more options with ONE price in Peaks, and no currency, no 'Up to', no help about sizes", () => {
    const html = render();
    expect(html).toContain("Uses 50 Peaks");
    expect(html).toContain("5,200 left this month");
    expect(html).toContain("Charged only if it works.");
    expect(html).toContain("Write more options");
    expect(html).not.toMatch(/[₹£$€]|Up to/);
    expect(html).not.toContain("Why these sizes?");
  });

  it("being written: progress, skeleton cards for what is still coming, and no price yet", () => {
    const html = render({ phase: "making", cards: [card()], pending: 3, progress: { done: 1, total: 4 } });
    expect(html).toContain("Writing your options");
    expect(html).toContain('data-slot="studio-making"');
    expect(html.split('aria-hidden="true"').length - 1).toBeGreaterThanOrEqual(3);
    expect(html).not.toContain("Write more options");
  });

  it("nothing came through: says it was not charged and offers Try again with a new price", () => {
    const html = render({ phase: "failed", cards: [] });
    expect(html).toContain("We couldn&#x27;t write options this time. You weren&#x27;t charged.");
    expect(html).toContain("Uses 50 Peaks");
    expect(html).toContain("Try again");
    expect(html).toContain('href="/dashboard/studio/new?c=abc"');
  });

  it("every card held back by the Safety check: not charged, reasons listed, a way back to the plan", () => {
    const html = render({ phase: "all_dropped", cards: [], droppedNotes: ["It made a claim we can't prove."] });
    expect(html).toContain("None of these passed our Safety check");
    expect(html).toContain("It made a claim we can&#x27;t prove.");
  });

  it("some held back: the plain line, with Why?", () => {
    expect(render({ droppedCount: 2, droppedNotes: ["x"] })).toContain("We left out 2 that didn&#x27;t pass our Safety check.");
  });

  it("the writer switched off: the text-ad coming-soon card with no price and no button, never the picture maker's words", () => {
    const html = render({ phase: "failed", cards: [], notReleased: true });
    expect(html).toContain("Text ads are coming soon");
    expect(html).not.toContain("Previews are coming soon");
    expect(html).not.toContain("Uses ");
    expect(html).not.toContain("Try again");
  });

  it("switched off while cards exist: the cards stay and the way to write more is gone", () => {
    const html = render({ notReleased: true });
    expect(html).toContain("Festive silk, flat 20% off");
    expect(html).not.toContain("Write more options");
  });

  it("a refusal for want of Peaks is written inside the card that asked, with the plain words", () => {
    const html = render({ refusal: { code: "CREDITS_EXHAUSTED", tone: "error", text: "You need 50 Peaks and have 10. Nothing was started and nothing was charged.", action: "retry" } });
    expect(html).toContain("You need 50 Peaks and have 10.");
  });
});
