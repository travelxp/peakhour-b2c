import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import type { CreativeView, FinalRow, PreviewView, PressQuote, ProductImage, ShortlistItem } from "@/lib/api/creative-studio";
import {
  affordableUnits,
  chosenForFinal,
  creativePhase,
  derivePressQuote,
  finalPhase,
  finalsSummary,
  groupProducts,
  isEligibleForFinal,
  isNotReleased,
  isWorking,
  linePlaceholder,
  makingProgress,
  cropScroll,
  paletteFromKit,
  photoMediaIdsFor,
  planBlock,
  pollInterval,
  receiptsOf,
  shortlistChip,
  studioRefusal,
  wordingOp,
} from "@/lib/studio-flow";

const err = (code: string, status: number, message = "msg", details?: unknown) => new ApiError(code, message, status, undefined, details);

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
  headlineBackdrop: null,
  ...over,
});

const view = (over: Partial<CreativeView> = {}): CreativeView => ({
  id: "c1",
  kind: "image",
  status: "previews_ready",
  brief: { productIds: ["prod1"], line: "", language: "en", format: "feed", noAiPeople: false, photoMediaIds: [], count: 4 },
  languages: ["en"],
  warnings: [],
  previews: [preview()],
  earlier: [],
  finals: [],
  versions: [],
  approval: { lookApproved: false },
  jobs: [],
  safetySummary: { dropped: 0, notes: [] },
  lastPress: null,
  updatedAt: "2026-11-19T00:00:00.000Z",
  ...over,
});

const quote = (over: Partial<PressQuote> = {}): PressQuote => ({
  main: { action: "creative.make_previews", peaks: 680, units: 4, perUnit: { unit: "preview", units: 4, peaksPerUnit: 170 }, token: "tok-main", expiresAt: 10_000_000 },
  cutout: null,
  totalPeaks: 680,
  ...over,
});

describe("studioRefusal (spec 4.2)", () => {
  it("a switched-off use case is the not-released state: never a toast, never a charge", () => {
    const r = studioRefusal(err("CREATIVE_NOT_RELEASED", 409), "Making previews");
    expect(r.tone).toBe("not_released");
    expect(r.text).toBe("Making previews isn't available yet. You weren't charged.");
    expect(isNotReleased(err("CREATIVE_NOT_RELEASED", 409))).toBe(true);
    expect(isNotReleased(err("OTHER", 409))).toBe(false);
  });

  it("too few Peaks: the figures, and that nothing was started or charged, with the way to add Peaks", () => {
    const r = studioRefusal(err("CREDITS_EXHAUSTED", 429, "x", { needed: 1360, remaining: 400 }));
    expect(r.text).toBe("You need 1,360 Peaks and have 400. Nothing was started and nothing was charged.");
    expect(r.action).toBe("add_peaks");
    expect(r.need).toBe(1360);
    expect(r.left).toBe(400);
  });

  it("a double press is one charge", () => {
    expect(studioRefusal(err("ACT_ALREADY_RUNNING", 409)).text).toBe("This is already being made. You'll be charged once.");
    expect(studioRefusal(err("ACT_ALREADY_RUNNING", 409)).action).toBe("see_progress");
  });

  it("a changed price asks for the new price, never re-sends the old receipt", () => {
    const r = studioRefusal(err("QUOTE_NOT_HONOURED", 409));
    expect(r.action).toBe("requote");
    expect(r.text).toContain("price changed");
  });

  it("each plain refusal says what happened", () => {
    expect(studioRefusal(err("FORBIDDEN", 403)).text).toBe("Ask an editor to do this.");
    expect(studioRefusal(err("STUDIO_CAP_REACHED", 429, "x", { cap: 5000 })).text).toBe("You've reached your Studio limit for this month (5,000 Peaks).");
    expect(studioRefusal(err("BRIEF_LOCKED", 409))).toMatchObject({ action: "new_plan", text: expect.stringContaining("Start a new plan") });
    expect(studioRefusal(err("TOO_MANY_PREVIEWS", 409))).toMatchObject({ action: "new_plan", text: expect.stringContaining("plenty of previews") });
    expect(studioRefusal(err("WORDS_ONLY", 422)).text).toBe("That is for pictures. For words only, write more options instead.");
    expect(studioRefusal(err("PHOTO_MISSING", 422, "Add a photo of Silk saree so the picture shows the real one.", { productIds: ["a"] }))).toMatchObject({
      text: "Add a photo of Silk saree so the picture shows the real one.",
      productIds: ["a"],
    });
    expect(studioRefusal(err("TEXT_DOES_NOT_FIT", 422)).text).toBe("That wording doesn't fit this layout. Try something shorter.");
    expect(studioRefusal(err("FONT_MISSING_GLYPH", 422)).text).toBe("This font can't show one of those letters. Try another word.");
    expect(studioRefusal(err("VERSION_CONFLICT", 409)).text).toBe("This was just changed by someone else. Showing the latest.");
    expect(studioRefusal(err("NOT_APPROVED", 409)).text).toContain("Tap the heart");
  });

  it("the api's own plain sentences for a change it cannot make are shown as they are, with no Try again", () => {
    const r = studioRefusal(err("NOTHING_SHORTER", 422, "There's no shorter wording. Type your own."));
    expect(r.text).toBe("There's no shorter wording. Type your own.");
    expect(r.action).toBeUndefined();
    expect(studioRefusal(err("LAYER_MISSING", 422, "This picture has no button to colour.")).text).toBe("This picture has no button to colour.");
    expect(studioRefusal(err("COLOUR_UNKNOWN", 422, "That colour isn't in your brand colours.")).action).toBeUndefined();
  });

  it("anything else says it went wrong, that nothing was charged, and offers Try again", () => {
    for (const e of [err("INTERNAL", 500), new Error("network"), "boom"]) {
      const r = studioRefusal(e);
      expect(r.text).toBe("Something went wrong. You weren't charged.");
      expect(r.action).toBe("retry");
    }
  });

  it("no refusal sentence carries a currency symbol", () => {
    const all = [
      err("CREDITS_EXHAUSTED", 429, "x", { needed: 5, remaining: 1 }),
      err("STUDIO_CAP_REACHED", 429, "x", { cap: 9 }),
      err("INTERNAL", 500),
    ].map((e) => studioRefusal(e).text);
    for (const t of all) expect(t).not.toMatch(/[₹£$€]/);
  });
});

describe("affordableUnits: 'Make {k} instead' (U11)", () => {
  it("offers fewer than wanted when the balance covers some", () => {
    expect(affordableUnits(400, 170, 4)).toBe(2);
    expect(affordableUnits(700, 170, 4)).toBe(3);
  });
  it("offers nothing when it covers none, or the price is unknown", () => {
    expect(affordableUnits(100, 170, 4)).toBeUndefined();
    expect(affordableUnits(undefined, 170, 4)).toBeUndefined();
    expect(affordableUnits(400, undefined, 4)).toBeUndefined();
  });
  it("never offers as many as were asked for", () => {
    expect(affordableUnits(10_000, 170, 4)).toBe(3);
  });
  it("counts what a press costs whatever the count (the cut-out), so the offer is one the balance really covers", () => {
    // 4 at 100 + a 150 cut-out = 550; with 330 left 3 would cost 450, so only 1 would fit
    expect(affordableUnits(330, 100, 4, 150)).toBe(1);
    expect(affordableUnits(500, 100, 4, 150)).toBe(3);
  });
});

describe("derivePressQuote: the price of a press", () => {
  const base = { enabled: true, isFetching: false, error: undefined, now: 1_000_000 };
  it("a live quote is the price, never loading or unavailable", () => {
    expect(derivePressQuote({ ...base, data: quote() })).toMatchObject({ loading: false, unavailable: false, notReleased: false, quote: { totalPeaks: 680 } });
  });
  it("a quote in hand beats a background refetch", () => {
    expect(derivePressQuote({ ...base, isFetching: true, data: quote() }).loading).toBe(false);
  });
  it("loading while asking with nothing in hand", () => {
    expect(derivePressQuote({ ...base, isFetching: true, data: undefined })).toMatchObject({ loading: true, unavailable: false });
  });
  it("unavailable when asked and nothing came back", () => {
    expect(derivePressQuote({ ...base, data: undefined, error: err("ACTION_NOT_PRICED", 502) })).toMatchObject({ unavailable: true, notReleased: false });
  });
  it("not released is its own state: no price, not unavailable", () => {
    const s = derivePressQuote({ ...base, data: undefined, error: err("CREATIVE_NOT_RELEASED", 409) });
    expect(s).toMatchObject({ notReleased: true, unavailable: false, loading: false, quote: undefined });
  });
  it("a surface that is not open has not asked: nothing is unavailable", () => {
    expect(derivePressQuote({ ...base, enabled: false, data: undefined })).toMatchObject({ loading: false, unavailable: false, notReleased: false });
  });
  it("a lapsed receipt is withheld, and so is the price that goes with it", () => {
    const s = derivePressQuote({ ...base, now: 10_000_000 - 1000, data: quote() });
    expect(s.quote).toBeUndefined();
    expect(receiptsOf(s.quote)).toEqual({});
  });
  it("one lapsed receipt of two withholds both", () => {
    const q = quote({ cutout: { action: "creative.cut_out_product", peaks: 60, token: "tok-cut", expiresAt: 1_000_010 } });
    expect(derivePressQuote({ ...base, data: q }).quote).toBeUndefined();
  });
});

describe("receipts", () => {
  it("both receipts go back on a press that has a cut-out", () => {
    const q = quote({ cutout: { action: "creative.cut_out_product", peaks: 60, token: "tok-cut", expiresAt: 9_999_999 }, totalPeaks: 740 });
    expect(receiptsOf(q)).toEqual({ main: "tok-main", cutout: "tok-cut" });
  });
  it("only the main receipt when no photo needs cutting out", () => {
    expect(receiptsOf(quote())).toEqual({ main: "tok-main" });
  });
});

describe("polling (spec 4.4)", () => {
  it("polls every 1.5 s at first, then every 4 s, while something is being made", () => {
    const v = view({ status: "making_previews", jobs: [{ id: "j", setId: "s", kind: "previews", state: "running", done: 1, total: 4 }] });
    expect(pollInterval(v, 0)).toBe(1500);
    expect(pollInterval(v, 29_999)).toBe(1500);
    expect(pollInterval(v, 30_000)).toBe(4000);
  });
  it("stops when nothing is in flight", () => {
    expect(pollInterval(view(), 0)).toBe(false);
    expect(pollInterval(undefined, 0)).toBe(false);
  });
  it("keeps going for a final that is queued, making or checking, and a preview on its way to final", () => {
    const f = (state: FinalRow["state"]): FinalRow => ({ id: "f", previewId: "p1", state, width: null, height: null, match: null });
    for (const s of ["queued", "making", "checking"] as const) expect(isWorking(view({ finals: [f(s)] }))).toBe(true);
    expect(isWorking(view({ finals: [f("ready"), f("blocked"), f("failed")] }))).toBe(false);
    expect(isWorking(view({ previews: [preview({ state: "finalizing" })] }))).toBe(true);
    expect(isWorking(view({ previews: [preview({ state: "rendering" })] }))).toBe(true);
  });
});

describe("what the creative page shows", () => {
  it("by status", () => {
    expect(creativePhase(view({ status: "brief" }))).toBe("brief");
    expect(creativePhase(view({ status: "making_previews" }))).toBe("making");
    expect(creativePhase(view({ status: "previews_ready" }))).toBe("ready");
    expect(creativePhase(view({ status: "has_final" }))).toBe("ready");
  });
  it("a set that all failed is 'failed'; one the Safety check left out entirely is 'all dropped'", () => {
    expect(creativePhase(view({ status: "previews_failed", previews: [] }))).toBe("failed");
    expect(creativePhase(view({ status: "previews_failed", previews: [], safetySummary: { dropped: 3, notes: ["x"] } }))).toBe("all_dropped");
  });
  it("progress comes from the job; without a job from the previews that have landed", () => {
    expect(makingProgress(view({ jobs: [{ id: "j", setId: "s", kind: "previews", state: "running", done: 2, total: 4 }] }))).toEqual({ done: 2, total: 4 });
    expect(makingProgress(view({ previews: [preview(), preview({ id: "p2", state: "rendering" })] }))).toEqual({ done: 1, total: 2 });
  });
});

describe("the shortlist and finals", () => {
  const item = (over: Partial<ShortlistItem> = {}): ShortlistItem => ({
    creativeId: "c1",
    previewId: "p1",
    state: "shortlisted",
    headline: "h",
    productTitle: null,
    thumbUrl: null,
    likedAt: null,
    lapsed: false,
    waitingLong: false,
    ...over,
  });
  it("only a hearted preview that is not already on its way can be made final", () => {
    expect(isEligibleForFinal(item())).toBe(true);
    expect(isEligibleForFinal(item({ state: "finalizing" }))).toBe(false);
    expect(isEligibleForFinal(item({ kind: "words" }))).toBe(false);
    expect(isEligibleForFinal(item({ state: "final_ready" }))).toBe(false);
    expect(isEligibleForFinal(item({ state: "ready", lapsed: true }))).toBe(false);
  });
  it("the choose sheet counts only what is still waiting, so the count and the price agree", () => {
    const items = [{ previewId: "a" }, { previewId: "b" }, { previewId: "c" }];
    expect(chosenForFinal(items, null).map((i) => i.previewId)).toEqual(["a", "b", "c"]);
    // "b" was ticked, then left the shortlist: it is not counted
    expect(chosenForFinal([items[0]!, items[2]!], new Set(["a", "b"])).map((i) => i.previewId)).toEqual(["a"]);
    expect(chosenForFinal(items, new Set())).toEqual([]);
    const thirty = Array.from({ length: 30 }, (_, i) => ({ previewId: String(i) }));
    expect(chosenForFinal(thirty, null)).toHaveLength(24);
    // what the merchant ticks is theirs: one beyond the first 24 is kept, and the sheet says when it is over the limit
    expect(chosenForFinal(thirty, new Set(["3", "27"])).map((i) => i.previewId)).toEqual(["3", "27"]);
  });
  it("chips", () => {
    expect(shortlistChip(item())).toBe("waiting");
    expect(shortlistChip(item({ state: "finalizing" }))).toBe("making");
    expect(shortlistChip(item({ state: "final_ready" }))).toBe("ready");
    expect(shortlistChip(item({ state: "final_blocked" }))).toBe("blocked");
    expect(shortlistChip(item({ state: "final_failed" }))).toBe("failed");
    expect(shortlistChip(item({ state: "ready", lapsed: true }))).toBe("changed");
  });
  it("a final not yet started is waiting its turn", () => {
    expect(finalPhase({ state: "queued" })).toBe("waiting");
    expect(finalPhase({ state: "checking" })).toBe("checking");
  });
  it("the summary appears only once finals are done and not all came through", () => {
    const f = (id: string, state: FinalRow["state"]): FinalRow => ({ id, previewId: id, state, width: null, height: null, match: null });
    expect(finalsSummary([f("a", "ready"), f("b", "blocked")])).toBe("1 of 2 are ready. You're charged for the 1 that came through.");
    expect(finalsSummary([f("a", "ready"), f("b", "ready")])).toBeNull();
    expect(finalsSummary([f("a", "ready"), f("b", "queued")])).toBeNull();
    expect(finalsSummary([])).toBeNull();
  });
});

describe("the plan", () => {
  const img = (over: Partial<ProductImage> & { id: string }): ProductImage => ({
    position: 0,
    media: { id: `m-${over.id}`, name: "x.jpg", mimeType: "image/jpeg", publicUrl: `https://x/${over.id}.jpg`, width: 1200, height: 1500 },
    ...over,
  });
  it("products are the Library photos grouped by product, the lead photo first; a photo with no product is not a product", () => {
    const out = groupProducts([
      img({ id: "a2", productId: "p1", productTitle: "Saree", position: 2 }),
      img({ id: "a0", productId: "p1", productTitle: "Saree", position: 0 }),
      img({ id: "b", productId: "p2", productTitle: "Scarf" }),
      img({ id: "orphan" }),
    ]);
    expect(out.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(out[0]!.photo!.mediaId).toBe("m-a0");
    expect(out[0]!.title).toBe("Saree");
  });
  it("a product with no photo blocks the plan and names the product; no product blocks too", () => {
    const has = new Set(["a"]);
    expect(planBlock({ productIds: [], hasPhoto: () => true, titleOf: () => "" })).toEqual({ kind: "no_product" });
    expect(planBlock({ productIds: ["a", "b"], hasPhoto: (id) => has.has(id), titleOf: (id) => `Title ${id}` })).toEqual({ kind: "no_photo", productId: "b", title: "Title b" });
    expect(planBlock({ productIds: ["a"], hasPhoto: (id) => has.has(id), titleOf: () => "" })).toBeNull();
  });
  it("photos are sent only when every product has one (they pair by position)", () => {
    expect(photoMediaIdsFor(["a", "b"], (id) => ({ a: "ma", b: "mb" })[id])).toEqual(["ma", "mb"]);
    expect(photoMediaIdsFor(["a", "b"], (id) => ({ a: "ma" })[id as "a"])).toEqual([]);
  });
  it("the placeholder comes from the idea", () => {
    expect(linePlaceholder({ festival: "Diwali", productTitle: "silk sarees" })).toBe("Diwali offer on silk sarees");
    expect(linePlaceholder({ productTitle: "Silk saree" })).toBe("Something to say about Silk saree");
    expect(linePlaceholder({})).toContain("For example");
  });
});

describe("Look closely opens on the product (CS-3d productCrop)", () => {
  const content = { w: 800, h: 1000 };
  const view = { w: 400, h: 500 };
  it("centres the product's crop in the window", () => {
    expect(cropScroll({ x: 0.5, y: 0.5, w: 0.25, h: 0.2 }, content, view)).toEqual({ left: 300, top: 350 });
  });
  it("never scrolls past an edge", () => {
    expect(cropScroll({ x: 0, y: 0, w: 0.1, h: 0.1 }, content, view)).toEqual({ left: 0, top: 0 });
    expect(cropScroll({ x: 0.9, y: 0.9, w: 0.1, h: 0.1 }, content, view)).toEqual({ left: 400, top: 500 });
  });
  it("opens at the top left, as before, when the api kept no crop", () => {
    expect(cropScroll(null, content, view)).toEqual({ left: 0, top: 0 });
  });
});

describe("the tweak controls", () => {
  it("colour keys are the ones the api derives from the brand kit, then its plain fallbacks", () => {
    const out = paletteFromKit([
      { hex: "#AA0000", name: "Deep Red" },
      { hex: "#aa0000", role: "accent" },
      { hex: "#112233", role: "primary" },
      { hex: "not-a-colour", name: "Bad" },
    ]);
    expect(out.slice(0, 3)).toEqual([
      { key: "deep-red", name: "Deep Red", hex: "#aa0000" },
      { key: "accent", name: "Accent", hex: "#aa0000" },
      { key: "primary", name: "Primary", hex: "#112233" },
    ]);
    // the api's fallbacks follow, except one whose key is already used or whose colour is already there
    expect(out.map((s) => s.key)).toEqual(expect.arrayContaining(["white", "gold", "black"]));
    expect(out.find((s) => s.key === "red")).toBeDefined();
  });
  it("two colours with the same name get a -2 key", () => {
    const out = paletteFromKit([{ hex: "#111111", name: "Gold" }, { hex: "#222222", name: "Gold" }]);
    expect(out.map((s) => s.key).slice(0, 2)).toEqual(["gold", "gold-2"]);
  });
  it("typed wording is trimmed, cut to the field's limit, and an empty one is not sent", () => {
    expect(wordingOp("headline", "  Flat 20% off ")).toEqual({ op: "headline.set", text: "Flat 20% off" });
    expect(wordingOp("cta", "x".repeat(50))).toEqual({ op: "cta.set", text: "x".repeat(24) });
    expect(wordingOp("offer", "Save 20%")).toEqual({ op: "offer.set", text: "Save 20%" });
    expect(wordingOp("headline", "   ")).toBeNull();
    // counted by characters: an emoji is one, and is never cut in two
    const cut = wordingOp("cta", "\u{1F600}".repeat(30))!.text;
    expect(Array.from(cut)).toHaveLength(24);
  });
});
