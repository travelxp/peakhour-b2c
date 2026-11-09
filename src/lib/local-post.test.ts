/**
 * S5·4 — composing a Local Post, checked while the merchant can still fix it.
 *
 * ⚠️WHAT THESE ASSERTIONS ARE REALLY DEFENDING. A validation refusal on the api
 * publish path is TERMINAL — the scheduled item ends at `failed`, tomorrow,
 * with no way to correct it in place. Every rule below exists to move that
 * moment to the compose screen, so each test is really "the merchant found out
 * in time".
 *
 * Killer titles are load-bearing — `scripts/mutate-compose-to-listing.mjs`
 * matches them for EQUALITY against vitest's JSON reporter.
 */
import { describe, it, expect } from "vitest";
import {
  buildListingChannelOptions,
  emptyListingDraft,
  listingDraftReady,
  listingProblems,
  LISTING_MAX_MEDIA,
  LISTING_SUMMARY_MAX,
  type ListingDraft,
  type ListingField,
} from "./local-post";

function draft(over: Partial<ListingDraft> = {}): ListingDraft {
  return { ...emptyListingDraft("Half price coffee all week."), ...over };
}

/** The fields that came back with a problem, in order. */
const fieldsOf = (d: ListingDraft): ListingField[] => listingProblems(d).map((p) => p.field);

/** The one problem on `field`, or a thrown assertion naming what did come back. */
function problemOn(d: ListingDraft, field: ListingField) {
  const found = listingProblems(d).filter((p) => p.field === field);
  if (found.length !== 1) {
    throw new Error(
      `expected exactly one problem on "${field}", got ${JSON.stringify(listingProblems(d))}`,
    );
  }
  return found[0]!;
}

describe("listingProblems — the body", () => {
  it("★★★will not schedule an empty post to a public listing", () => {
    expect(fieldsOf(draft({ summary: "   " }))).toContain("summary");
  });

  it("★★★catches an over-long body HERE, where it can still be shortened", () => {
    // ⚠️THE API REFUSES THIS TOO, and its refusal is terminal — a scheduled item
    // that ends at `failed` tomorrow. Catching it now is the whole point.
    const p = problemOn(draft({ summary: "x".repeat(LISTING_SUMMARY_MAX + 40) }), "summary");
    // ★THE NUMBERS, NOT JUST "too long". A cap with no count is a puzzle.
    expect(p.message).toContain(String(LISTING_SUMMARY_MAX + 40));
    expect(p.message).toContain("40");
  });

  it("★★accepts a body of exactly the limit", () => {
    expect(listingDraftReady(draft({ summary: "x".repeat(LISTING_SUMMARY_MAX) }))).toBe(true);
  });

  it("★★measures the limit against the trimmed body", () => {
    const summary = `  ${"x".repeat(LISTING_SUMMARY_MAX)}  `;
    expect(listingDraftReady(draft({ summary }))).toBe(true);
  });
});

describe("listingProblems — the window an event and an offer share", () => {
  const evt = { topicType: "EVENT" as const, eventTitle: "Winter sale", eventStartDate: "2026-12-01" };

  it("★★★asks an OFFER for a window too, because Google gives offers no dates of their own", () => {
    const fields = fieldsOf(draft({ topicType: "OFFER" }));
    expect(fields).toContain("eventTitle");
    expect(fields).toContain("eventStartDate");
  });

  it("★★★asks an EVENT for a title and a start date", () => {
    const fields = fieldsOf(draft({ topicType: "EVENT" }));
    expect(fields).toContain("eventTitle");
    expect(fields).toContain("eventStartDate");
  });

  it("★★★never asks a plain update for a window", () => {
    expect(listingDraftReady(draft())).toBe(true);
  });

  it("★★★catches a window that ends before it starts", () => {
    const p = problemOn(draft({ ...evt, eventEndDate: "2026-11-30" }), "eventEndDate");
    expect(p.message).toContain("never appear");
  });

  it("★★accepts a window that starts and ends on the same day", () => {
    expect(listingDraftReady(draft({ ...evt, eventEndDate: "2026-12-01" }))).toBe(true);
  });

  it("★★compares the window by calendar date, not by day of the month", () => {
    // 02 → 30 reads as forward if only the day is compared.
    expect(fieldsOf(draft({ ...evt, eventStartDate: "2026-12-02", eventEndDate: "2026-11-30" })))
      .toContain("eventEndDate");
  });

  it("★★refuses a well-shaped but impossible date", () => {
    expect(fieldsOf(draft({ ...evt, eventStartDate: "2026-02-30" }))).toContain("eventStartDate");
  });

  it("★★an open-ended window is fine", () => {
    expect(listingDraftReady(draft(evt))).toBe(true);
  });
});

describe("listingProblems — the button", () => {
  it("★★★refuses a link with no button rather than guessing one", () => {
    // Inferring "Learn more" would publish a button the merchant never chose.
    expect(fieldsOf(draft({ actionUrl: "https://acme.example" }))).toContain("actionType");
  });

  it("★★★refuses a button with nowhere to go, and says THAT rather than talking about https", () => {
    // ⚠️ASSERTED ON THE MESSAGE, BECAUSE THE FIELD ALONE COULD NOT TELL THE TWO
    // BRANCHES APART. Deleting the empty check falls through to the https one —
    // `isHttpsUrl("")` is false — so a problem is still reported on
    // `actionUrl` and a field-only assertion stayed green. What the merchant
    // sees is the whole difference: "a button needs somewhere to go" against
    // "needs to be a full https:// link" for a box they have not filled in.
    const p = problemOn(draft({ actionType: "SHOP" }), "actionUrl");
    expect(p.message).toContain("somewhere to go");
  });

  it("★★★refuses a button link Google cannot reach over https", () => {
    for (const url of ["http://acme.example", "acme.example", "blob:https://a.example/x"]) {
      expect(fieldsOf(draft({ actionType: "SHOP", actionUrl: url })), url).toContain("actionUrl");
    }
  });

  it("★★★refuses a link typed alongside a Call button rather than dropping it", () => {
    const p = problemOn(draft({ actionType: "CALL", actionUrl: "https://acme.example" }), "actionUrl");
    expect(p.message).toContain("phone number");
  });

  it("★★a Call button on its own is fine", () => {
    expect(listingDraftReady(draft({ actionType: "CALL" }))).toBe(true);
  });

  it("★★no button at all is fine", () => {
    expect(listingDraftReady(draft())).toBe(true);
  });
});

describe("listingProblems — media", () => {
  it("★★★refuses more images than a listing post carries", () => {
    const mediaUrls = Array.from(
      { length: LISTING_MAX_MEDIA + 1 },
      (_, i) => `https://a.example/${i}.jpg`,
    );
    expect(fieldsOf(draft({ mediaUrls }))).toContain("media");
  });

  it("★★★refuses an image Google's fetcher cannot reach", () => {
    expect(fieldsOf(draft({ mediaUrls: ["http://a.example/1.jpg"] }))).toContain("media");
  });

  it("★★counts the cap after blanks are dropped", () => {
    const mediaUrls = [
      ...Array.from({ length: LISTING_MAX_MEDIA }, (_, i) => `https://a.example/${i}.jpg`),
      "   ",
    ];
    expect(listingDraftReady(draft({ mediaUrls }))).toBe(true);
  });
});

describe("listingProblems — reporting", () => {
  it("★★★reports EVERY problem at once, not just the first", () => {
    // ⚠️A FORM THAT SURFACES ONE ERROR AT A TIME makes the merchant submit four
    // times to find four mistakes. The api returns one refusal because it only
    // has to explain why it stopped; this has to explain what to fix.
    const fields = fieldsOf(
      draft({
        summary: "",
        topicType: "OFFER",
        actionUrl: "https://acme.example",
        mediaUrls: ["http://a.example/1.jpg"],
      }),
    );
    expect(new Set(fields)).toEqual(
      new Set(["summary", "eventTitle", "eventStartDate", "actionType", "media"]),
    );
  });
});

describe("buildListingChannelOptions", () => {
  it("sends a plain update as nothing but its topic type", () => {
    expect(buildListingChannelOptions(draft())).toEqual({ topicType: "STANDARD" });
  });

  it("★★★never sends an empty actionType, which the api refuses", () => {
    // "" is not the same as absent: sending it fails a post over a button
    // nobody asked for.
    expect(buildListingChannelOptions(draft())).not.toHaveProperty("actionType");
  });

  it("★★★never sends a URL alongside a Call button", () => {
    const opts = buildListingChannelOptions(draft({ actionType: "CALL", actionUrl: "" }));
    expect(opts.actionType).toBe("CALL");
    expect(opts).not.toHaveProperty("actionUrl");
  });

  it("carries a button and its link through", () => {
    const opts = buildListingChannelOptions(
      draft({ actionType: "SHOP", actionUrl: "https://acme.example/shop" }),
    );
    expect(opts).toMatchObject({ actionType: "SHOP", actionUrl: "https://acme.example/shop" });
  });

  it("★★★carries the window for an EVENT", () => {
    const opts = buildListingChannelOptions(
      draft({
        topicType: "EVENT",
        eventTitle: "Winter sale",
        eventStartDate: "2026-12-01",
        eventEndDate: "2026-12-24",
      }),
    );
    expect(opts.event).toEqual({
      title: "Winter sale",
      startDate: "2026-12-01",
      endDate: "2026-12-24",
    });
  });

  it("★★omits an absent end date rather than sending an empty one", () => {
    const opts = buildListingChannelOptions(
      draft({ topicType: "EVENT", eventTitle: "T", eventStartDate: "2026-12-01" }),
    );
    expect(opts.event).not.toHaveProperty("endDate");
  });

  it("★★★never attaches a window or an offer to a plain update", () => {
    // A merchant who filled in the event fields, then switched back to Update,
    // must not silently publish a dated post.
    const opts = buildListingChannelOptions(
      draft({
        eventTitle: "Winter sale",
        eventStartDate: "2026-12-01",
        couponCode: "WINTER20",
      }),
    );
    expect(opts).not.toHaveProperty("event");
    expect(opts).not.toHaveProperty("offer");
  });

  it("★★★carries the offer body, and the window with it", () => {
    const opts = buildListingChannelOptions(
      draft({
        topicType: "OFFER",
        eventTitle: "Winter sale",
        eventStartDate: "2026-12-01",
        couponCode: "WINTER20",
        redeemOnlineUrl: "https://acme.example/winter",
        termsConditions: "One per customer.",
      }),
    );
    expect(opts).toMatchObject({
      topicType: "OFFER",
      event: { title: "Winter sale", startDate: "2026-12-01" },
      offer: {
        couponCode: "WINTER20",
        redeemOnlineUrl: "https://acme.example/winter",
        termsConditions: "One per customer.",
      },
    });
  });

  it("★★omits the offer object entirely when none of its fields were filled in", () => {
    const opts = buildListingChannelOptions(
      draft({ topicType: "OFFER", eventTitle: "T", eventStartDate: "2026-12-01" }),
    );
    expect(opts).not.toHaveProperty("offer");
  });
});
