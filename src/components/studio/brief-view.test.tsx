import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { BriefView } = await import("./brief-view");
const { ProductPickerView } = await import("./product-picker");
const { QuoteBlock } = await import("./studio-quote");

import type { BriefViewProps } from "./brief-view";

const noop = () => {};
const base = (over: Partial<BriefViewProps> = {}): BriefViewProps => ({
  status: "ready",
  kind: "image" as BriefViewProps["kind"],
  products: [{ id: "p1", title: "Silk saree", photoUrl: "https://x/p1.jpg", hasPhoto: true }],
  line: "",
  linePlaceholder: "Diwali offer on silk sarees",
  language: "en",
  format: "story",
  count: 4,
  noAiPeople: false,
  platform: null,
  platforms: { state: "ready", choices: [{ key: "instagram", label: "Instagram" }, { key: "linkedin", label: "LinkedIn" }] },
  proTools: false,
  previews: "on",
  block: null,
  quote: { state: "quote", peaks: 680, units: 4, onRetry: noop },
  left: 5200,
  canMake: true,
  saving: false,
  saveFailed: false,
  planSaved: false,
  starting: false,
  brandNudge: false,
  onLine: noop,
  onLanguage: noop,
  onFormat: noop,
  onCount: noop,
  onKind: noop,
  onNoAiPeople: noop,
  onPlatform: noop,
  onChangeProducts: noop,
  onRemoveProduct: noop,
  addPhoto: (id) => <button data-add-photo={id}>Add a photo</button>,
  onMake: noop,
  onSave: noop,
  onRetry: noop,
  onRequote: noop,
  onRetryLoad: noop,
  onRetrySave: noop,
  ...over,
});
const render = (over: Partial<BriefViewProps> = {}) => renderToStaticMarkup(<BriefView {...base(over)} />);
/** The primary button's tag, to read whether it is disabled. */
const makeButton = (html: string, label: string) => new RegExp(`<button[^>]*>${label}</button>`).exec(html)?.[0] ?? "";

describe("the plan (S3): the rows", () => {
  it("shows the plan with every row, the idea's placeholder and the sticky price bar", () => {
    const html = render();
    for (const t of ["What we&#x27;re making", "Products", "What should the post say?", "Where it will go", "Options"]) expect(html).toContain(t);
    expect(html).toContain("Silk saree");
    expect(html).toContain('placeholder="Diwali offer on silk sarees"');
    expect(html).toContain('data-slot="studio-brief-bar"');
  });

  it("Picture ad and Words only are choices; only Short video is a 'Coming soon' tile", () => {
    const html = render();
    expect(/role="radio" aria-checked="true"[^>]*>Picture ad</.test(html)).toBe(true);
    expect(/role="radio" aria-checked="false"[^>]*>Words only</.test(html)).toBe(true);
    expect(html).toContain("Short video");
    expect(html.split("Coming soon").length - 1).toBe(1);
  });

  it("a words-only plan: no photo rows, no shape, no people switch, options not previews, one price", () => {
    const html = render({ kind: "words", products: [{ id: "p1", title: "Silk saree", hasPhoto: true }], quote: { state: "quote", peaks: 50, onRetry: noop } });
    expect(/aria-checked="true"[^>]*>Words only</.test(html)).toBe(true);
    expect(html).toContain("We&#x27;ll write headline and text options.");
    expect(html).not.toContain("Where it will go");
    expect(html).not.toContain("No AI people");
    expect(html).not.toContain("Add a photo");
    expect(html).toContain("Write 4 options");
    expect(html).toContain("Uses 50 Peaks");
    expect(html).not.toContain("Up to 50");
    expect(makeButton(html, "Write 4 options")).not.toContain(`disabled=""`);
  });

  it("a words-only plan asks for the platform first: Not sure yet is the default and the connected platforms follow", () => {
    const html = render({ kind: "words" });
    expect(html).toContain("Where will you post it?");
    expect(/role="radio" aria-checked="true"[^>]*>Not sure yet</.test(html)).toBe(true);
    expect(/role="radio" aria-checked="false"[^>]*>Instagram</.test(html)).toBe(true);
    expect(/role="radio" aria-checked="false"[^>]*>LinkedIn</.test(html)).toBe(true);
    expect(html).toContain("We&#x27;ll write for Facebook and Instagram.");
    expect(render({ kind: "words", platform: "linkedin" })).toMatch(/aria-checked="true"[^>]*>LinkedIn</);
    // a picture plan has no platform row: the picture is made first and sent to each platform after
    expect(render({ kind: "image" })).not.toContain("Where will you post it?");
  });

  it("the platform row says what it cannot show: loading, a failed read, no account connected, and keeps a plan's platform that is not connected now", () => {
    expect(render({ kind: "words", platforms: { state: "loading", choices: [] } })).toContain("Finding your connected accounts");
    expect(render({ kind: "words", platforms: { state: "failed", choices: [] } })).toContain("couldn&#x27;t read your connected accounts");
    const none = render({ kind: "words", platforms: { state: "ready", choices: [] } });
    expect(none).toContain("No account is connected yet");
    expect(none).toContain("/dashboard/integrations");
    expect(render({ kind: "words", platform: "threads", platforms: { state: "ready", choices: [] } })).toMatch(/aria-checked="true"[^>]*>Threads</);
  });

  it("a words-only plan with the writer off shows the text-ad coming-soon card, never the picture maker's", () => {
    const html = render({ kind: "words", previews: "coming_soon" });
    expect(html).toContain("Text ads are coming soon");
    expect(html).not.toContain("Previews are coming soon");
    expect(html).toContain("Save this plan");
  });

  it("the shape is a radio group with the idea's format chosen", () => {
    const html = render();
    expect(html).toContain('role="radiogroup"');
    expect(/aria-checked="true"[^>]*>Story</.test(html)).toBe(true);
  });

  it("language and the number of previews sit under Options for a novice, on the main screen with Pro tools", () => {
    const novice = render();
    const pro = render({ proTools: true });
    const optionsAt = (h: string) => h.indexOf("<details");
    expect(novice.indexOf("studio-language")).toBeGreaterThan(optionsAt(novice));
    expect(pro.indexOf("studio-language")).toBeLessThan(optionsAt(pro));
  });

  it("the line has a counter and is limited to 140 characters", () => {
    const html = render({ line: "Flat 20% off" });
    expect(html).toContain('maxLength="140"');
    expect(html).toContain("12 of 140");
  });

  it("shows the brand nudge only when the kit is empty", () => {
    expect(render()).not.toContain("Add your logo and colours");
    expect(render({ brandNudge: true })).toContain("Add your logo and colours for better previews.");
  });
});

describe("the plan: states", () => {
  it("loading draws skeletons, no price and no button", () => {
    const html = render({ status: "loading" });
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("Make 4 previews");
  });

  it("an idea that has passed offers Start from scratch", () => {
    const html = render({ ideaGone: true });
    expect(html).toContain("That idea has passed");
    expect(html).toContain("Start from scratch");
    expect(html).not.toContain("Make 4 previews");
  });

  it("the price comes first: 'Up to N Peaks for 4 previews', what is left, charged only if it works, and the help", () => {
    const html = render();
    expect(html).toContain("Up to 680 Peaks for 4 previews. You&#x27;re charged only for the ones that come through.");
    expect(html).toContain("5,200 left this month");
    expect(html).toContain("Charged only if it works.");
    expect(html).toContain('aria-label="Why these sizes?"');
    expect(html).toContain("You&#x27;ll see the previews before anything is final.");
    expect(makeButton(html, "Make 4 previews")).not.toContain('disabled=""');
  });

  it("the button says how many previews the segmented count chose", () => {
    expect(render({ count: 3 })).toContain("Make 3 previews");
  });

  it("a product with no photo: the button is off and the line says which product needs one (PHOTO_MISSING upstream)", () => {
    const html = render({
      products: [{ id: "p1", title: "Silk saree", hasPhoto: false }],
      block: { kind: "no_photo", productId: "p1", title: "Silk saree" },
    });
    expect(html).toContain("No photo yet");
    expect(html).toContain("Add a photo of Silk saree so the picture shows the real one.");
    expect(html).toContain('data-add-photo="p1"');
    expect(makeButton(html, "Make 4 previews")).toContain('disabled=""');
    expect(html).not.toContain("Up to 680 Peaks");
  });

  it("no product yet says so and keeps the button off", () => {
    const html = render({ products: [], block: { kind: "no_product" } });
    expect(html).toContain("No product chosen yet");
    expect(html).toContain("Choose a product to start.");
    expect(makeButton(html, "Make 4 previews")).toContain('disabled=""');
  });

  it("a small photo is a warning, never a block", () => {
    const html = render({ products: [{ id: "p1", title: "Silk saree", hasPhoto: true, smallPhoto: true }] });
    expect(html).toContain("This photo is small. The picture may look soft. Add a bigger one for a sharper result.");
    expect(makeButton(html, "Make 4 previews")).not.toContain('disabled=""');
  });

  it("the price is being worked out: polite text, button off", () => {
    const html = render({ quote: { state: "loading", onRetry: noop } });
    expect(html).toContain("Working out what this costs…");
    expect(html).toContain('aria-live="polite"');
    expect(makeButton(html, "Make 4 previews")).toContain('disabled=""');
  });

  it("the price cannot be worked out: says so, offers Retry, button off (never a made-up figure)", () => {
    const html = render({ quote: { state: "unavailable", onRetry: noop } });
    expect(html).toContain("We can&#x27;t work out the price right now. Try again in a moment.");
    expect(html).toContain("Retry");
    expect(makeButton(html, "Make 4 previews")).toContain('disabled=""');
  });

  it("free work says Free, never '0 Peaks'", () => {
    const html = renderToStaticMarkup(<QuoteBlock state="quote" peaks={0} free left={null} />);
    expect(html).toContain("Free");
    expect(html).not.toContain("0 Peaks");
  });

  it("saving the plan, or an unsaved change, holds the button", () => {
    expect(makeButton(render({ saving: true }), "Make 4 previews")).toContain('disabled=""');
    expect(render({ starting: true })).toContain("Starting…");
  });

  it("a viewer cannot make: the button is off and the line says to ask an editor", () => {
    const html = render({ canMake: false });
    expect(html).toContain("Ask an editor to make this.");
    expect(makeButton(html, "Make 4 previews")).toContain('disabled=""');
  });

  it("not enough Peaks: the api's sentence, Add Peaks, and 'Make 3 previews instead' when 3 are covered", () => {
    const html = render({
      refusal: { code: "CREDITS_EXHAUSTED", tone: "error", text: "You need 680 Peaks and have 520. Nothing was started and nothing was charged.", action: "add_peaks", need: 680, left: 520 },
      makeInstead: { label: "Make 3 previews instead", onPress: noop },
    });
    expect(html).toContain('role="alert"');
    expect(html).toContain("You need 680 Peaks and have 520. Nothing was started and nothing was charged.");
    expect(html).toContain('href="/dashboard/peaks"');
    expect(html).toContain("Add Peaks");
    expect(html).toContain("Make 3 previews instead");
  });

  it("a failed save says so, offers Try again, and the button stays off until a save works (the price is for the old plan)", () => {
    const html = render({ saveFailed: true, saving: true });
    expect(html).toContain("We couldn&#x27;t save your plan.");
    expect(html).toContain("Try again");
    expect(makeButton(html, "Make 4 previews")).toContain('disabled=""');
  });

  it("a saved plan that is not there says so and offers Start from scratch, never an endless skeleton", () => {
    const html = render({ loadError: "gone" });
    expect(html).toContain("We can&#x27;t find that plan");
    expect(html).toContain("Start from scratch");
    expect(html).not.toContain('aria-busy="true"');
  });

  it("a plan or ideas that could not be read is an error with Retry", () => {
    const html = render({ loadError: "error" });
    expect(html).toContain("We couldn&#x27;t load your plan");
    expect(html).toContain("Retry");
    expect(html).not.toContain("Make 4 previews");
  });

  it("a plan with the price not yet known (availability loading) shows no price and no coming-soon card", () => {
    const html = render({ previews: "unknown" });
    expect(html).not.toContain("Previews are coming soon");
    expect(html).not.toContain("Up to 680 Peaks");
    expect(makeButton(html, "Make 4 previews")).toContain('disabled=""');
  });
});

describe("the plan while previews are not available yet (spec 4.3)", () => {
  const html = render({ previews: "coming_soon" });
  it("shows the designed coming-soon card with the exact words", () => {
    expect(html).toContain("Previews are coming soon");
    expect(html).toContain("We&#x27;re getting the picture maker ready. Your ideas, Library and settings work now. We&#x27;ll tell you the day previews open.");
  });
  it("never a quote line, never a Peaks figure, never the Make button", () => {
    expect(html).not.toContain("Peaks for");
    expect(html).not.toContain("left this month");
    expect(html).not.toContain("Charged only if it works.");
    expect(html).not.toContain("Make 4 previews");
    expect(html).not.toContain('data-slot="studio-brief-bar"');
  });
  it("offers Save this plan (free) and Back to ideas", () => {
    expect(html).toContain("Save this plan");
    expect(html).toContain("Back to ideas");
    expect(html).toContain('href="/dashboard/studio"');
  });
  it("says the plan is saved once it is", () => {
    expect(render({ previews: "coming_soon", planSaved: true })).toContain("Plan saved. It&#x27;s waiting under Saved plans.");
  });
  it("Save this plan waits for a product and a photo", () => {
    const blocked = render({ previews: "coming_soon", block: { kind: "no_product" } });
    expect(blocked).toMatch(/disabled=""[^>]*>Save this plan/);
  });
});

describe("the product picker (S4)", () => {
  const products = [
    { id: "p1", title: "Silk saree", photo: { mediaId: "m1", url: "https://x/1.jpg", width: 800, height: 1000 } },
    { id: "p2", title: "Cotton scarf" },
    { id: "p3", title: "Brass lamp" },
  ];
  const pick = (over: Partial<Parameters<typeof ProductPickerView>[0]> = {}) =>
    renderToStaticMarkup(
      <ProductPickerView status="ready" products={products} selected={[]} query="" onQuery={noop} onToggle={noop} onRetry={noop} {...over} />,
    );

  it("tiles are checkboxes named by the product, and the counter says how many of three", () => {
    const html = pick({ selected: ["p1"] });
    expect(html).toContain('role="checkbox"');
    expect(/aria-checked="true"[^>]*>(?:(?!<\/button>).)*Silk saree/.test(html)).toBe(true);
    expect(html).toContain("1 of 3 chosen");
    expect(html).toContain('aria-live="polite"');
  });

  it("a product with no usable photo address shows its title in a tile, never a broken image", () => {
    const html = pick();
    expect(html.split("<img").length - 1).toBe(1);
    expect(html).toContain("Cotton scarf");
  });

  it("a fourth tick is refused inline, with the limit named", () => {
    expect(pick({ selected: ["p1", "p2", "p3"], overLimit: true })).toContain("You can pick up to 3 for one post.");
  });

  it("loading draws skeletons; an error has Retry and never reads as an empty list; offline has no retry", () => {
    expect(pick({ status: "loading", products: [] })).toContain('aria-busy="true"');
    const err = pick({ status: "error", products: [] });
    expect(err).toContain("Retry");
    expect(err).not.toContain("No products yet");
    const off = pick({ status: "offline", products: [] });
    expect(off).toContain("offline");
    expect(off).not.toContain("Retry");
  });

  it("no products: the empty state; a search with no match names the search", () => {
    expect(pick({ products: [] })).toContain("No products yet");
    const html = pick({ query: "zzz" });
    expect(html).toContain("No products match &quot;zzz&quot;.");
  });

  it("a search narrows the tiles", () => {
    const html = pick({ query: "lamp" });
    expect(html).toContain("Brass lamp");
    expect(html).not.toContain("Silk saree");
  });

  it("says photos are still coming in while the store import runs, and when it stopped", () => {
    expect(pick({ importing: true })).toContain("Getting photos from your store…");
    expect(pick({ importStopped: "Shopify stopped sharing photos." })).toContain("Shopify stopped sharing photos.");
  });
});
