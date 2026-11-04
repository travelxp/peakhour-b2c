import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { BrandPrefill, KitFileCandidate, KitView } from "@/lib/api/brand-kit";

vi.mock("@/lib/api", () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(), getWithMeta: vi.fn() }, ApiError: class extends Error {}, API_BASE_URL: "https://api.example" }));

const { BrandKitView, BrandKitSkeleton, BrandKitLoadError, BrandKitOffline } = await import("./brand-kit-view");
const { PrefillReview } = await import("./prefill-review");
const { KitFileResults, offered } = await import("./kit-file-picker");
const { draftFromView } = await import("@/lib/brand-kit");

const noop = () => {};
const view = (over: Partial<KitView> = {}): KitView => ({
  logos: [],
  colors: [],
  fonts: [],
  guidelines: [],
  from: { logos: "none", colors: "none", fonts: "none", guidelineMediaIds: "none" },
  ...over,
});

type Props = Parameters<typeof BrandKitView>[0];
const props = (over: Partial<Props> = {}): Props => ({
  scope: "org",
  scopes: ["org", "business"],
  businessName: "Monsoon Tea Co.",
  draft: draftFromView(null),
  effective: view(),
  voice: null,
  websiteUrl: "https://monsoon.example/",
  dirty: false,
  saving: false,
  error: null,
  hasOverride: false,
  review: null,
  prefillBusy: false,
  fontHintText: null,
  onScope: noop,
  onSave: noop,
  onDiscard: noop,
  onRevert: noop,
  onPrefill: noop,
  onAddLogo: noop,
  onLogoForm: noop,
  onRemoveLogo: noop,
  onAddColor: () => null,
  onColorRole: noop,
  onRemoveColor: noop,
  onAddFont: noop,
  onFontRole: noop,
  onRemoveFont: noop,
  onAddGuideline: noop,
  onRemoveGuideline: noop,
  onOpenGuideline: noop,
  ...over,
});
const render = (over: Partial<Props> = {}) => renderToStaticMarkup(<BrandKitView {...props(over)} />);

const FILLED = view({
  logos: [
    { mediaId: "l1", form: "primary", url: "https://media.example/l1.png", mimeType: "image/png", name: "Monsoon" },
    { mediaId: "l2", form: "icon", url: "https://media.example/l2.png", mimeType: "image/png", name: "Mark" },
  ],
  colors: [
    { hex: "#1f4d3f", role: "primary" },
    { hex: "#f3e6c8" },
  ],
  fonts: [{ mediaId: "f1", role: "heading", family: "Fraunces", url: "https://media.example/f1.woff2", mimeType: "font/woff2" }],
  guidelines: [
    { mediaId: "g1", name: "Brand book 2026.pdf", mimeType: "application/pdf", visibility: "private" },
    { mediaId: "g2", name: "Packaging rules.pdf", mimeType: "application/pdf", visibility: "published", url: "https://media.example/p.pdf" },
  ],
  from: { logos: "org", colors: "org", fonts: "org", guidelineMediaIds: "org" },
});

describe("Brand Kit tab: the page's own words", () => {
  it("opens with the line from the board and the pill for who the kit is shared with", () => {
    const out = render();
    expect(out).toContain("Every creative and ad Peakhour makes reads from here. Change it once and new work follows.");
    expect(out).toContain("Shared with every business");
    for (const h of ["Logos", "Colours", "Fonts", "Voice", "Guidelines"]) expect(out).toContain(`>${h}</h2>`);
  });

  it("uses no word the brief rules out for a merchant", () => {
    const out = render({ draft: draftFromView(FILLED), voice: { tone: "Warm." }, dirty: true });
    for (const bad of ["AI processing", "Analysing", "Analyzing", "delete", "Delete"]) expect(out).not.toContain(bad);
  });
});

describe("Brand Kit tab: an empty kit", () => {
  it("offers to start from the website when the business has one, and the review comes before any save", () => {
    const out = render();
    expect(out).toContain("Your Brand Kit is empty");
    expect(out).toContain("You review them before anything is saved.");
    expect(out).toContain("Start from my website");
  });

  it("with no website, says to add by hand, offers no pre-fill button and explains why Read my website is off", () => {
    const out = render({ websiteUrl: null });
    expect(out).toContain("Add a logo and your colours below.");
    expect(out).not.toContain("Start from my website");
    expect(out).toMatch(/<button[^>]*\sdisabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Read my website/);
    expect(out).toContain("This business has no website address on file.");
  });

  it("the empty prompt gives way to the review panel while one is open", () => {
    const out = render({ review: <p>REVIEW</p> });
    expect(out).toContain("REVIEW");
    expect(out).not.toContain("Your Brand Kit is empty");
  });
});

describe("Brand Kit tab: a filled kit", () => {
  const out = render({ draft: draftFromView(FILLED), voice: { tone: "Warm and unhurried.", vocabulary: ["estate"], avoidTerms: ["cheap"], sampleHeadlines: ["From our hills"] } });

  it("shows each logo with its form, each colour with its hex and role, and no empty prompt", () => {
    expect(out).toContain("Monsoon (Primary)");
    expect(out).toContain("Mark (Icon)");
    expect(out).toContain("#1f4d3f");
    expect(out).toContain("#f3e6c8");
    expect(out).not.toContain("Your Brand Kit is empty");
  });

  it("shows the voice from the Brand Voice, with the words it uses and avoids", () => {
    expect(out).toContain("Warm and unhurried.");
    expect(out).toContain("Words we use");
    expect(out).toContain("estate");
    expect(out).toContain("Words we avoid");
    expect(out).toContain("cheap");
    expect(out).toContain("From your Brand Voice.");
  });

  it("marks a Private guideline as private and says it is shared only by an expiring link; a Published one is not marked", () => {
    expect(out).toContain("Brand book 2026.pdf");
    expect(out).toContain("Private. Shared only by expiring link.");
    expect(out.match(/>Private</g)).toHaveLength(1);
  });

  it("every card can be changed, and each change has a name a screen reader can say", () => {
    for (const l of ["Remove Monsoon", "Remove #1f4d3f", "Remove Brand book 2026.pdf", "Add a logo", "Add colour", "Add a font file", "Add a document", "Which form is Monsoon"]) {
      expect(out).toContain(l);
    }
  });

  it("no save bar until something is edited", () => {
    expect(out).not.toContain("Unsaved changes");
    expect(out).not.toContain("Save Brand Kit");
  });
});

describe("Brand Kit tab: unsaved changes", () => {
  it("shows the bar with Save and Discard; for the organisation it says every business is changed", () => {
    const out = render({ draft: draftFromView(FILLED), dirty: true });
    expect(out).toContain("You have changes that are not saved.");
    expect(out).toContain("Saving changes the kit for every business.");
    expect(out).toContain("Save Brand Kit");
    expect(out).toContain("Discard");
  });

  it("for one business it does not say that", () => {
    const out = render({ scope: "business", scopes: ["business"], draft: draftFromView(FILLED), dirty: true });
    expect(out).toContain("You have changes that are not saved.");
    expect(out).not.toContain("every business.");
  });

  it("while saving, the buttons are off and the label says what is happening", () => {
    const out = render({ draft: draftFromView(FILLED), dirty: true, saving: true });
    expect(out).toContain("Saving…");
    expect(out).toMatch(/<button[^>]*\sdisabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Saving…/);
    expect(out).toMatch(/<button[^>]*\sdisabled=""[^>]*>Discard/);
  });

  it("the other scope cannot be switched to while edits are unsaved, and the reason is on the button", () => {
    const out = render({ draft: draftFromView(FILLED), dirty: true });
    expect(out).toContain("Save or discard your changes first.");
    expect(out).toMatch(/aria-pressed="false"[^>]*disabled=""[^>]*title="Save or discard your changes first\."/);
  });

  it("a failed save says why, as an alert, and keeps the bar", () => {
    const out = render({ draft: draftFromView(FILLED), dirty: true, error: "A logo must be a Published file." });
    expect(out).toContain('role="alert"');
    expect(out).toContain("A logo must be a Published file.");
    expect(out).toContain("Save Brand Kit");
  });
});

describe("Brand Kit tab: the two scopes", () => {
  it("an admin sees both scopes, with the pressed one marked and the business named", () => {
    const out = render();
    expect(out).toContain("Every business");
    expect(out).toContain("Just Monsoon Tea Co.");
    expect(out).toMatch(/aria-pressed="true"[^>]*>Every business</);
  });

  it("an editor has one scope and so no switch", () => {
    const out = render({ scope: "business", scopes: ["business"] });
    expect(out).not.toContain("Who this kit is for");
    expect(out).toContain("Monsoon Tea Co. only");
  });

  it("a business with its own kit can go back to following the organisation; one without cannot", () => {
    expect(render({ scope: "business", hasOverride: true })).toContain("Use the organisation&#x27;s kit instead");
    expect(render({ scope: "business", hasOverride: false })).not.toContain("Use the organisation&#x27;s kit instead");
    expect(render({ scope: "org", hasOverride: true })).not.toContain("Use the organisation&#x27;s kit instead");
  });

  it("a business section left empty says it follows the organisation, and only for the sections that do", () => {
    const effective = view({ from: { logos: "org", colors: "none", fonts: "none", guidelineMediaIds: "none" } });
    const out = render({ scope: "business", scopes: ["business"], effective });
    expect(out.match(/Following the organisation&#x27;s kit/g)).toHaveLength(1);
  });
});

describe("Brand Kit tab: someone who may only look", () => {
  const out = render({ scope: null, scopes: [], draft: draftFromView(FILLED) });

  it("shows the kit, says it cannot be changed, and draws no control that changes it", () => {
    expect(out).toContain("Monsoon");
    expect(out).toContain("You can look at the Brand Kit. An editor or admin can change it.");
    expect(out).toContain("Read only");
    for (const w of ["Remove ", "Add a logo", "Add colour", "Add a font file", "Add a document", "Read my website", "Save Brand Kit", "Start from my website"]) {
      expect(out).not.toContain(w);
    }
  });

  it("draws no save bar even if a change were somehow marked unsaved", () => {
    expect(render({ scope: null, scopes: [], draft: draftFromView(FILLED), dirty: true })).not.toContain("Save Brand Kit");
  });

  it("still opens a guideline, which is reading", () => {
    expect(out).toContain("Brand book 2026.pdf");
  });
});

describe("Brand Kit tab: logos Google cannot use", () => {
  it("warns when every logo is an SVG, and not when a PNG is there", () => {
    const svg = view({ logos: [{ mediaId: "l1", form: "primary", url: "u", mimeType: "image/svg+xml", name: "Mark" }] });
    expect(render({ draft: draftFromView(svg) })).toContain("Google ads take a PNG or JPEG logo");
    expect(render({ draft: draftFromView(FILLED) })).not.toContain("Google ads take a PNG or JPEG logo");
  });
});

describe("Brand Kit tab: fonts", () => {
  it("shows a font with its role and the licence line, and a hint from the website when there is one", () => {
    const out = render({ draft: draftFromView(FILLED), fontHintText: "Your website uses Poppins. Add the font files you are licensed to use and ads will match." });
    expect(out).toContain("Heading Aa");
    expect(out).toContain("Fraunces");
    expect(out).toContain("Use only fonts you are licensed to use.");
    expect(out).toContain("Your website uses Poppins.");
  });

  it("with no fonts says ads use a default, not that something is broken", () => {
    expect(render()).toContain("No fonts yet. Ads and creatives use a clean default.");
  });
});

describe("Brand Kit tab: before there is a kit", () => {
  it("loading is a status, an error offers a retry, and an offline tab says so", () => {
    expect(renderToStaticMarkup(<BrandKitSkeleton />)).toContain('aria-label="Loading your Brand Kit"');
    const err = renderToStaticMarkup(<BrandKitLoadError message="Your Brand Kit could not be loaded." onRetry={noop} />);
    expect(err).toContain('role="alert"');
    expect(err).toContain("Try again");
    expect(renderToStaticMarkup(<BrandKitOffline />)).toContain("You look to be offline.");
  });
});

// ── the review of what the website held ──────────────────────────────────────

const PREFILL: BrandPrefill = {
  websiteUrl: "https://www.monsoon.example/",
  colors: [
    { hex: "#1f4d3f", role: "primary", source: "theme-color" },
    { hex: "#c8954a", source: "most-used" },
  ],
  logos: [{ url: "https://cdn.example/logo.png", source: "img-logo" }],
  fontFamilies: ["Fraunces"],
};
const review = (state: Parameters<typeof PrefillReview>[0]["state"], label = "Use these") =>
  renderToStaticMarkup(<PrefillReview state={state} confirmLabel={label} onToggleColor={noop} onToggleLogo={noop} onConfirm={noop} onDismiss={noop} onRetry={noop} />);

describe("Website review", () => {
  it("while reading it is a status in plain words", () => {
    const out = review({ status: "loading" });
    expect(out).toContain('role="status"');
    expect(out).toContain("Reading your website…");
  });

  it("a failed read says why and offers to try again or close; nothing is selectable", () => {
    const out = review({ status: "error", message: "That is a lot of website reads in a short time." });
    expect(out).toContain('role="alert"');
    expect(out).toContain("Try again");
    expect(out).toContain("Close");
    expect(out).not.toContain('type="checkbox"');
  });

  it("ready: lists what was found, ticks it, names the site, and the confirm button carries the caller's words", () => {
    const out = review({ status: "ready", data: PREFILL, selection: { colors: ["#1f4d3f", "#c8954a"], logos: ["https://cdn.example/logo.png"] }, applying: false }, "Save and continue");
    expect(out).toContain("We found 2 colours, 1 logo and 1 font on monsoon.example.");
    expect(out.match(/type="checkbox"[^>]*checked=""/g)).toHaveLength(3);
    expect(out).toContain("#c8954a");
    expect(out).toContain("A logo you keep is added to Drive as a Published image.");
    expect(out).toContain("Your website uses Fraunces.");
    expect(out).toContain("Save and continue");
  });

  it("unticked suggestions are not checked, and with none ticked the confirm button is off and says why", () => {
    const out = review({ status: "ready", data: PREFILL, selection: { colors: [], logos: [] }, applying: false });
    expect(out).not.toMatch(/checked=""/);
    expect(out).toMatch(/<button[^>]*\sdisabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Use these/);
    expect(out).toContain("Tick at least one to continue.");
  });

  it("while adding, the button is off and says Adding", () => {
    const out = review({ status: "ready", data: PREFILL, selection: { colors: ["#1f4d3f"], logos: [] }, applying: true });
    expect(out).toContain("Adding…");
    expect(out).toMatch(/<button[^>]*\sdisabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Adding…/);
  });

  it("a partly imported run keeps the review up with the reason as an alert", () => {
    const out = review({ status: "ready", data: PREFILL, selection: { colors: [], logos: ["https://cdn.example/logo.png"] }, applying: false, notice: "One logo could not be added: Too big." });
    expect(out).toContain('role="alert"');
    expect(out).toContain("One logo could not be added: Too big.");
  });

  it("a site with nothing on it says so and offers only to close", () => {
    const out = review({ status: "ready", data: { ...PREFILL, colors: [], logos: [], fontFamilies: [] }, selection: { colors: [], logos: [] }, applying: false });
    expect(out).toContain("We could not find a logo, colour or font on monsoon.example.");
    expect(out).toContain("Close");
    expect(out).not.toContain("Tick at least one");
  });
});

// ── choosing a Drive file for the kit ────────────────────────────────────────

const file = (over: Partial<KitFileCandidate> = {}): KitFileCandidate => ({ id: "m1", name: "Logo.png", kind: "image", visibility: "published", shared: true, mimeType: "image/png", publicUrl: "https://media.example/m1.png", sizeBytes: 2048, ...over });
const results = (state: Parameters<typeof KitFileResults>[0]["state"], over: Partial<Parameters<typeof KitFileResults>[0]> = {}) =>
  renderToStaticMarkup(<KitFileResults state={state} kind="image" scope="business" query="" onPick={noop} onRetry={noop} {...over} />);

describe("Choosing a file for the kit", () => {
  it("lists only what the organisation's kit may hold, and counts the rest instead of hiding them silently", () => {
    const items = [file({ id: "a", shared: true }), file({ id: "b", shared: false }), file({ id: "c", shared: false })];
    expect(offered(items, "org")).toMatchObject({ held: 2, shown: [{ id: "a" }] });
    expect(offered(items, "business")).toMatchObject({ held: 0 });
    expect(offered(items, "business").shown).toHaveLength(3);
    const out = results({ status: "ready", items }, { scope: "org" });
    expect(out).toContain("2 files belong to one business and are not listed.");
    expect(out.match(/aria-label="Use /g)).toHaveLength(1);
  });

  it("says why only Published files are offered for a logo and a font, but not for a document", () => {
    expect(results({ status: "ready", items: [file()] })).toContain("Only Published images are listed");
    expect(results({ status: "ready", items: [file({ kind: "font", name: "F.woff2" })] }, { kind: "font" })).toContain("Only Published fonts are listed");
    expect(results({ status: "ready", items: [file({ kind: "document", name: "Book.pdf", visibility: "private", publicUrl: undefined })] }, { kind: "document" })).not.toContain("Only Published");
  });

  it("a Private document is marked as such in the list", () => {
    expect(results({ status: "ready", items: [file({ kind: "document", name: "Book.pdf", visibility: "private", publicUrl: undefined })] }, { kind: "document" })).toContain("Private");
  });

  it("empty Drive offers the Upload tray when the page gave one, and not otherwise", () => {
    expect(results({ status: "ready", items: [] }, { kind: "font", onUpload: noop })).toContain("Upload a file");
    expect(results({ status: "ready", items: [] }, { kind: "font" })).not.toContain("Upload a file");
    expect(results({ status: "ready", items: [] }, { kind: "font" })).toContain("There are no Published font files in Drive yet.");
  });

  it("a search with no match says so and does not offer to upload", () => {
    const out = results({ status: "ready", items: [] }, { query: "blue tin", onUpload: noop });
    expect(out).toContain("Nothing matches");
    expect(out).toContain("blue tin");
    expect(out).not.toContain("Upload a file");
  });

  it("loading and error are distinct, and the error can be retried", () => {
    expect(results({ status: "loading" })).toContain("Loading your images…");
    const err = results({ status: "error", message: "Drive could not be read. Try again." });
    expect(err).toContain('role="alert"');
    expect(err).toContain("Try again");
  });
});
