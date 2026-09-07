import { describe, it, expect } from "vitest";
import {
  blockerNote,
  headline,
  isUsableVisibility,
  stateLabel,
  windowPhrase,
  windowSentence,
  type VisibilityReady,
} from "./search-visibility";

/**
 * The copy layer over the search-visibility endpoint.
 *
 * ★★WHAT THIS FILE DEFENDS IS ONE SENTENCE. The api spent four review rounds
 * building a gate on "Google did not show this product" — because every way of
 * getting it wrong produces a confident claim about a merchant's business that
 * we cannot support, and none of them look like a bug. A screen that read the
 * counts and ignored the flags would undo all of it in one line, and it would
 * read perfectly.
 *
 * ★AND THE SHOPIFY APP HAS THE TWIN OF THIS FILE. Neither decides anything —
 * both phrase what `absenceAssertable`, `absenceBlockers`,
 * `summary.unknownWindowCovered` and `window` already say — which is what keeps
 * two surfaces from disagreeing about the same catalogue. These specs assert
 * the same rules on this side.
 */

const ready = (over: Partial<VisibilityReady> = {}): VisibilityReady => ({
  state: "ready",
  siteUrl: "https://shop.example.com",
  syncedAt: "2026-09-07T02:00:00.000Z",
  stale: false,
  catalogTruncated: false,
  window: { start: "2026-08-09T00:00:00.000Z", end: "2026-09-06T23:59:59.999Z" },
  absenceAssertable: true,
  absenceBlockers: [],
  summary: {
    total: 20,
    earning: 5,
    seen_not_clicked: 2,
    barely_seen: 2,
    unknown: 11,
    no_url: 0,
    unknownWindowCovered: 11,
  },
  matching: 20,
  products: [],
  ...over,
});

describe("headline — the sentence the feature is for", () => {
  it("makes the strong claim only when the gate is open, and dates it", () => {
    const h = headline(ready());
    expect(h.asserted).toBe(true);
    expect(h.count).toBe(11);
    expect(h.text).toContain("11 products have not appeared in a Google search");
    // ★★THE DAY NUMBERS ARE ASSERTED, NOT THE MONTH SPELLING. The window is UTC
    // by construction and must print as UTC: a close of 6 Sep 23:59:59Z reads
    // "7 Sept" for every merchant east of UTC, silently moving a dated claim
    // about their business by a day. The month abbreviation is locale-dependent
    // ("Sep" / "Sept") and asserting it would only pin the runner's locale.
    expect(h.text).toMatch(/\b9 \w+ 2026\b/);
    expect(h.text).toMatch(/\b6 \w+ 2026\b/);
    expect(h.text).not.toMatch(/\b7 \w+ 2026\b/);
  });

  // ★★THE GATE IS NOT A HINT. With a blocker set the numbers look identical and
  // the sentence must change SUBJECT — from the merchant's products to our data.
  it("softens to a statement about our data when absence cannot be asserted", () => {
    const h = headline(ready({ absenceAssertable: false, absenceBlockers: ["slice_truncated"] }));
    expect(h.asserted).toBe(false);
    expect(h.text).toBe("We don't have search data for 11 products yet.");
    expect(h.text).not.toContain("not appeared");
  });

  // ★★THE COUNT IS `unknownWindowCovered`, NEVER `unknown` — the difference is
  // products we cannot speak about, and quoting the larger number is exactly
  // the overcount the api added that field to prevent.
  it("counts only the products the window covers", () => {
    const h = headline(ready({ summary: { ...ready().summary, unknown: 11, unknownWindowCovered: 4 } }));
    expect(h.count).toBe(4);
    expect(h.text).toContain("4 products have not appeared");
    expect(h.text).not.toContain("11");
  });

  it("does not assert over zero covered products, even with the gate open", () => {
    const h = headline(ready({ summary: { ...ready().summary, unknown: 3, unknownWindowCovered: 0 } }));
    expect(h.asserted).toBe(false);
    expect(h.text).toBe("We don't have search data for 3 products yet.");
  });

  // ★`asserted` IS FALSE ON THE ALL-CLEAR, because nothing is being asserted
  // about ABSENCE. Its Shopify twin reported the GATE here and painted a red
  // zero beside the good news.
  it("says the good news as good news rather than as a zero", () => {
    const h = headline(ready({ summary: { ...ready().summary, unknown: 0, unknownWindowCovered: 0 } }));
    expect(h.text).toBe("Every product we can measure is showing up in Google search.");
    expect(h.text).not.toContain("0 ");
    expect(h.asserted).toBe(false);
    expect(h.count).toBe(0);
  });

  it("joins the dates with a word, not a dash, inside the sentence", () => {
    const h = headline(ready());
    expect(h.text).toContain(" and ");
    expect(h.text).not.toContain("–");
  });

  it("uses the singular for one product", () => {
    const h = headline(ready({ summary: { ...ready().summary, unknown: 1, unknownWindowCovered: 1 } }));
    expect(h.text).toContain("1 product has not appeared");
  });

  it("omits the dates rather than printing an invalid range", () => {
    const h = headline(ready({ window: { start: "not-a-date", end: "also-not" } }));
    expect(h.asserted).toBe(true);
    expect(h.text).toBe("11 products have not appeared in a Google search.");
    expect(h.text).not.toContain("Invalid");
  });
});

describe("blockerNote", () => {
  it("says nothing when nothing is holding the answer back", () => {
    expect(blockerNote([])).toBe("");
  });

  // ★THE WRONG-PROPERTY CASE IS THE ONE THE MERCHANT CAN FIX, and the one that
  // would otherwise have produced a confident, completely wrong answer about
  // their whole catalogue.
  it("names the wrong-property case in terms the merchant can act on", () => {
    const note = blockerNote(["property_mismatch"]);
    expect(note).toContain("does not serve this store");
    expect(note).toContain("check which site is connected");
  });

  it("joins several reasons into one sentence", () => {
    const note = blockerNote(["slice_truncated", "rows_lost"]);
    expect(note).toContain("low-traffic");
    expect(note).toContain("did not save");
  });

  // ★★AN UNKNOWN BLOCKER IS NAMED, NOT SWALLOWED — an empty caveat beside
  // softened wording reads as a bug in the copy rather than a limit on the data.
  it("still says something for a reason it does not recognise", () => {
    const note = blockerNote(["some_new_reason"]);
    expect(note).not.toBe("");
    expect(note).toContain("some_new_reason");
  });

  // ★★AND A BLOCKER NAMED LIKE AN Object.prototype MEMBER IS NOT A FUNCTION.
  // `BLOCKER_NOTE["toString"]` inherits one, which is not nullish — so a `??`
  // fallback would never fire and the caveat would print the source of
  // `toString`. `.join()` stringifies before anything escapes it.
  it("survives a blocker name that collides with Object.prototype", () => {
    const note = blockerNote(["toString", "constructor"]);
    expect(note).toContain("toString");
    expect(note).not.toContain("native code");
    expect(note).not.toContain("function");
  });

  it("ignores empty and non-string entries", () => {
    expect(blockerNote(["", null as never, undefined as never])).toBe("");
  });
});

describe("stateLabel", () => {
  it("names every state the api can return", () => {
    for (const s of ["earning", "seen_not_clicked", "barely_seen", "unknown", "no_url"]) {
      expect(stateLabel(s).label).not.toBe(s);
      expect(stateLabel(s).blurb).not.toBe("");
    }
  });

  // ★`unknown` IS ABOUT US, NOT ABOUT THE MERCHANT — the distinction the whole
  // api is built around. Its blurb must not read as a verdict on the product.
  it("describes `unknown` as our gap rather than the product's failure", () => {
    const { label, blurb } = stateLabel("unknown");
    expect(label).toBe("No data");
    expect(blurb).toContain("We hold no search data");
    expect(blurb).not.toContain("never");
  });

  it("shows an unrecognised state rather than hiding the row", () => {
    expect(stateLabel("future_state").label).toBe("future_state");
  });

  // ★★`Object.hasOwn`, NOT `??`. An object literal inherits from
  // `Object.prototype`, so a state named `toString` resolves to a FUNCTION —
  // not nullish — and `??` would never reach the fallback, rendering the source
  // of `toString` as a badge.
  it("survives a state name that collides with Object.prototype", () => {
    for (const key of ["toString", "constructor", "hasOwnProperty"]) {
      const { label, tone } = stateLabel(key);
      expect(label).toBe(key);
      expect(tone).toBe("neutral");
    }
  });
});

describe("windowSentence / windowPhrase", () => {
  it("renders both dates with a dash when standalone", () => {
    const s = windowSentence({ start: "2026-08-09T00:00:00.000Z", end: "2026-09-06T23:59:59.999Z" });
    expect(s).toContain("–");
    expect(s).toMatch(/\b6 \w+ 2026\b/);
  });

  it("joins them with a word inside a sentence", () => {
    const p = windowPhrase({ start: "2026-08-09T00:00:00.000Z", end: "2026-09-06T23:59:59.999Z" });
    expect(p).toContain(" and ");
    expect(p).not.toContain("–");
  });

  it("says nothing when either end will not parse", () => {
    expect(windowSentence({ start: "nope", end: "2026-09-06T00:00:00.000Z" })).toBe("");
    expect(windowSentence({ start: "2026-08-09T00:00:00.000Z", end: "nope" })).toBe("");
    expect(windowSentence(undefined)).toBe("");
    expect(windowPhrase(undefined)).toBe("");
  });
});

describe("isUsableVisibility", () => {
  it("accepts a well-formed ready answer", () => {
    expect(isUsableVisibility(ready())).toBe(true);
  });

  it("rejects the non-ready arms", () => {
    for (const state of ["not_connected", "not_configured", "no_catalog", "pending"] as const) {
      expect(isUsableVisibility({ state })).toBe(false);
    }
    expect(isUsableVisibility(null)).toBe(false);
    expect(isUsableVisibility(undefined)).toBe(false);
  });

  // ★★A 200 WE CANNOT MAKE SENSE OF IS A FAILED READ. The counters format
  // whatever they are given, so a truncated body would otherwise reach the
  // headline and print "NaN products have not appeared in a Google search".
  it("rejects a half-written body rather than letting it reach the headline", () => {
    expect(isUsableVisibility(ready({ summary: undefined as never }))).toBe(false);
    expect(isUsableVisibility(ready({ summary: { ...ready().summary, total: NaN } }))).toBe(false);
    expect(
      isUsableVisibility(ready({ summary: { ...ready().summary, unknownWindowCovered: NaN } })),
    ).toBe(false);
    expect(isUsableVisibility(ready({ products: undefined as never }))).toBe(false);
    expect(isUsableVisibility(ready({ absenceBlockers: undefined as never }))).toBe(false);
    expect(isUsableVisibility(ready({ siteUrl: 42 as never }))).toBe(false);
  });

  it("rejects a body with no `matching`, which drives every count of rows", () => {
    expect(isUsableVisibility(ready({ matching: undefined as never }))).toBe(false);
    expect(isUsableVisibility(ready({ matching: NaN }))).toBe(false);
  });

  it("rejects a products array containing a non-object entry", () => {
    expect(isUsableVisibility(ready({ products: [null] as never }))).toBe(false);
    expect(isUsableVisibility(ready({ products: ["nope"] as never }))).toBe(false);
    expect(isUsableVisibility(ready({ products: [] }))).toBe(true);
  });
});
