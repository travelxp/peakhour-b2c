import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { askLine, canOfferDraft, copyLabel, draftButton, kitEmptyState, posterCopy, svgDataUri, DRAFT_SAVED_NOTE } from "@/lib/review-kit";

const sources = ["src/lib/review-kit.ts", "src/components/presence/review-kit-card.tsx", "src/components/presence/review-poster.tsx"];
const code = (rel: string) =>
  readFileSync(rel, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("the kit's words", () => {
  it("the network word comes only from the declaration", () => {
    expect(askLine({ networkLabel: "Google" })).toBe("Review us on Google");
    expect(askLine({})).toBe("Leave us a review");
    expect(posterCopy({ businessName: " Peak Coffee ", networkLabel: "Bing" }).headline).toBe("Tell others about your visit on Bing");
    expect(posterCopy({ businessName: "Peak Coffee" }).headline).toBe("Tell others about your visit");
    expect(posterCopy({ businessName: " Peak Coffee " }).businessName).toBe("Peak Coffee");
  });
  it("the UI holds no network name of its own", () => {
    for (const f of sources) expect(code(f), f).not.toMatch(/google|bing|yelp|facebook|tripadvisor|trustpilot|gbp/i);
  });
  it("no gating: nothing in the kit reads a rating, and the poster asks for an honest review, not a good one", () => {
    for (const f of sources) expect(code(f), f).not.toMatch(/rating|sentiment|stars?\b|happy|satisfied/i);
    const copy = posterCopy({ businessName: "x" });
    expect(`${copy.headline} ${copy.subline}`).toMatch(/honest/);
    expect(`${copy.headline} ${copy.subline}`).not.toMatch(/5|five|star|best|great|love|discount|free|win|offer/i);
  });
  it("an empty kit says what to do next, and a ready one says nothing", () => {
    expect(kitEmptyState({ state: "no_listing", draftPrice: null })?.headline).toMatch(/Connect your listing/);
    expect(kitEmptyState({ state: "no_link", draftPrice: 2 })?.description).toMatch(/Nothing is wrong/);
    expect(kitEmptyState(undefined)).toBeNull();
    expect(kitEmptyState({ state: "ready", listingId: "a", businessName: "b", link: "https://x.example/r", network: "n", qrSvg: "<svg/>", draftPrice: 1 })).toBeNull();
  });
  it("the qr is an <img> source, escaped", () => {
    const uri = svgDataUri('<svg a="1"><path d="M0,0"/></svg>');
    expect(uri.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(uri).not.toContain("<");
  });
  it("copy states", () => {
    expect(copyLabel("idle")).toBe("Copy link");
    expect(copyLabel("copied")).toBe("Link copied");
    expect(copyLabel("failed")).toMatch(/Select the link/);
  });
});

describe("the draft button", () => {
  it("shows the price before it is pressed, and is off with no price row", () => {
    expect(draftButton(4)).toEqual({ text: "Draft a reply · 4 AI credits", available: true });
    expect(draftButton(0)).toEqual({ text: "Draft a reply · Free", available: true });
    expect(draftButton(null)).toEqual({ text: "Draft a reply", available: false });
    expect(draftButton(undefined).available).toBe(false);
  });
  it("is offered on every unanswered review whatever its rating", () => {
    for (const rating of [1, 3, 5, undefined]) expect(canOfferDraft({ kind: "review", review: (rating ? { rating } : {}) as { replyPublished?: string } }), String(rating)).toBe(true);
  });
  it("is not offered on an answered review or on something that is not a review", () => {
    expect(canOfferDraft({ kind: "review", review: { replyPublished: "Thanks!" } })).toBe(false);
    expect(canOfferDraft({ kind: "review", review: { replyPublished: "  " } })).toBe(true);
    expect(canOfferDraft({ kind: "lead" })).toBe(false);
  });
  it("the saved note says it was not sent", () => {
    expect(DRAFT_SAVED_NOTE).toMatch(/Nothing is sent until you press Send/);
  });
});
