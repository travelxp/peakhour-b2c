import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { LibraryItem } from "@/lib/api/creative";
import type { ProductImportStatus } from "@/lib/api/media";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { bulkSummary, chipFor, creativeHref, downloadChoices, filterQuery, importLines, itemTitle, pageCount, sentTo, subLine } from "@/lib/studio-library";

describe("importLines", () => {
  const imp = (over: Partial<ProductImportStatus>): ProductImportStatus => ({ source: "shopify", status: "done", ...over });
  it("running says photos are on the way, in the store's name", () => {
    const [l] = importLines([imp({ status: "running" })]);
    expect(l).toMatchObject({ state: "running", text: "Getting photos from your Shopify store..." });
  });
  it("stopped carries the api's plain reason", () => {
    const [l] = importLines([imp({ status: "stopped", source: "woocommerce", stoppedReason: "Your Library is full, so product photos were not imported." })]);
    expect(l).toMatchObject({ state: "stopped", text: "Photos from your WooCommerce store paused", reason: "Your Library is full, so product photos were not imported." });
  });
  it("stopped with no reason still says something plain", () => {
    expect(importLines([imp({ status: "stopped" })])[0]!.reason).toBe(STUDIO_COPY.library.imports.stoppedFallback);
    expect(importLines([imp({ status: "stopped", stoppedReason: "   " })])[0]!.reason).toBe(STUDIO_COPY.library.imports.stoppedFallback);
  });
  it("done names the last check, and leaves out a time it cannot read", () => {
    expect(importLines([imp({ lastRunAt: "2026-11-18T10:00:00.000Z" })], "en-GB")[0]!.text).toBe("Photos from your Shopify store are up to date. Last checked 18 Nov 2026.");
    expect(importLines([imp({ lastRunAt: "nonsense" })])[0]!.text).toBe("Photos from your Shopify store are up to date.");
    expect(importLines([imp({})])[0]!.text).not.toContain("Last checked");
  });
  it("one line per store, in the api's order", () => {
    expect(importLines([imp({}), imp({ source: "woocommerce", status: "running" })]).map((l) => l.source)).toEqual(["shopify", "woocommerce"]);
  });
});

describe("small helpers", () => {
  it("chips say only what the list knows", () => {
    expect(chipFor({ status: "has_final" }, "made")).toBe("Final");
    expect(chipFor({ status: "archived" }, "made")).toBe("Archived");
    expect(chipFor({ status: "brief" }, "plans")).toBe("Saved plan");
  });
  it("a words creative is Approved words once one is approved, plain Words before; where it went and archived win, as for a picture", () => {
    const w = (state: "none" | "scheduled" | "posted", approved = 2) => ({ status: "previews_ready" as const, kind: "words" as const, words: { options: 3, approved, card: null, platform: null }, publish: { state, scheduled: 0, posted: 0, channels: [], inAd: false } });
    expect(chipFor(w("none"), "made")).toBe("Approved words");
    expect(chipFor(w("none", 0), "made")).toBe("Words");
    expect(chipFor(w("posted"), "made")).toBe("Posted");
    expect(chipFor(w("scheduled"), "made")).toBe("Scheduled");
    expect(chipFor({ ...w("posted"), status: "archived" }, "made")).toBe("Archived");
    expect(chipFor(w("none"), "plans")).toBe("Saved plan");
  });
  it("the line under a tile is a picture's shape, or what is in a words set and the platform it was written for", () => {
    const name = (k: string) => (k === "linkedin" ? "LinkedIn" : k);
    expect(subLine({ kind: "image", format: "story", words: null }, "Story", name)).toBe("Story");
    expect(subLine({ kind: "words", format: "feed", words: { options: 3, approved: 1, card: null, platform: null } }, "Words only", name)).toBe("3 options, 1 approved");
    expect(subLine({ kind: "words", format: "feed", words: { options: 3, approved: 1, card: null, platform: "linkedin" } }, "Words only", name)).toBe("3 options, 1 approved. Written for LinkedIn");
    expect(subLine({ kind: "words", format: "feed", words: null }, "Words only", name)).toBe("Words only");
  });
  it("the chip follows where it was sent: scheduled while any size waits, else posted, else plain Final; archived and plans win", () => {
    const sent = (state: "none" | "scheduled" | "posted") => ({ status: "has_final" as const, publish: { state, scheduled: 0, posted: 0, channels: [], inAd: false } });
    expect(chipFor(sent("scheduled"), "made")).toBe("Scheduled");
    expect(chipFor(sent("posted"), "made")).toBe("Posted");
    expect(chipFor(sent("none"), "made")).toBe("Final");
    expect(chipFor({ ...sent("posted"), status: "archived" }, "made")).toBe("Archived");
    expect(chipFor(sent("posted"), "plans")).toBe("Saved plan");
  });
  it("names the channels it was sent to, in words, and says nothing when it was not sent", () => {
    expect(sentTo({ publish: { state: "posted", scheduled: 0, posted: 2, channels: ["instagram", "linkedin"], inAd: false } })).toBe("Instagram, LinkedIn");
    expect(sentTo({ publish: { state: "posted", scheduled: 0, posted: 1, channels: ["mastodon"], inAd: false } })).toBe("mastodon");
    expect(sentTo({ publish: { state: "none", scheduled: 0, posted: 0, channels: [], inAd: false } })).toBe("");
  });
  it("an item with no headline is titled plainly", () => {
    expect(itemTitle({ headline: null })).toBe("Untitled post");
    expect(itemTitle({ headline: "  " })).toBe("Untitled post");
    expect(itemTitle({ headline: "Diwali sale" })).toBe("Diwali sale");
  });
  it("opens the creative's page, escaping the id", () => expect(creativeHref("a/b")).toBe("/dashboard/studio/c/a%2Fb"));
  it("pageCount never goes below one", () => {
    expect(pageCount(0, 24)).toBe(1);
    expect(pageCount(25, 24)).toBe(2);
    expect(pageCount(5, 0)).toBe(5);
  });
});

describe("the CMS storage page", () => {
  it("names the imported_store source instead of showing the raw string", () => {
    const src = readFileSync(resolve(__dirname, "../app/(site)/cms/storage/page.tsx"), "utf8");
    expect(src).toMatch(/imported_store:\s*"Product photos \(store\)"/);
    const media = readFileSync(resolve(__dirname, "api/media.ts"), "utf8");
    expect(media).toMatch(/\|\s*"imported_store"/);
  });
});

describe("filterQuery", () => {
  it("leaves out what is empty and sends dates as the start of that day in the merchant's own time zone; 'until' includes that day", () => {
    expect(filterQuery({ publish: "", channel: "", from: "", to: "" })).toEqual({});
    expect(filterQuery({ publish: "scheduled", channel: "instagram", from: "2026-11-05", to: "2026-11-10" })).toEqual({
      publish: "scheduled",
      channel: "instagram",
      from: new Date(2026, 10, 5).toISOString(),
      to: new Date(2026, 10, 11).toISOString(),
    });
  });
  it("'until' the last day of a month is the first of the next", () => expect(filterQuery({ publish: "", channel: "", from: "", to: "2026-11-30" }).to).toBe(new Date(2026, 11, 1).toISOString()));
  it("ignores a value it cannot read rather than sending it", () => {
    expect(filterQuery({ publish: "everywhere", channel: "", from: "05/11/2026", to: "tomorrow" })).toEqual({});
  });
});

describe("downloadChoices", () => {
  const item = (over: Partial<Pick<LibraryItem, "master" | "versions">>) => ({ master: null, versions: [], ...over });
  it("the full-size picture first, then each size, with its measurements in words", () => {
    const c = downloadChoices(
      item({
        master: { finalId: "f1", width: 1080, height: 1350 },
        versions: [{ id: "v1", label: "Feed post", channel: "instagram", width: 1080, height: 1350, state: "ready" }],
      }),
    );
    expect(c.map((x) => x.label)).toEqual(["Full size (1080 x 1350)", "Feed post, Instagram (1080 x 1350)"]);
    expect(c[0]!.query).toEqual({ finalId: "f1" });
    expect(c[1]!.query).toEqual({ versionId: "v1" });
  });
  it("a master with no measurements is still just 'Full size', and no picture means no choices", () => {
    expect(downloadChoices(item({ master: { finalId: "f1", width: null, height: null } }))[0]!.label).toBe("Full size");
    expect(downloadChoices(item({}))).toEqual([]);
  });
});

describe("bulkSummary", () => {
  it("says what was done and, plainly, how many were left as they were", () => {
    expect(bulkSummary({ done: ["a"], skipped: [] })).toBe("Done: 1 post.");
    expect(bulkSummary({ done: ["a", "b"], skipped: [] })).toBe("Done: 2 posts.");
    expect(bulkSummary({ done: ["a", "b"], skipped: [{ id: "c", code: "STILL_MAKING", message: "This one is still being made." }] })).toBe("Done: 2. Left as they were: 1. This one is still being made.");
  });
  it("gives each distinct reason once, at most two, in the api's own words", () => {
    const skipped = ["a", "b", "c", "d"].map((id, i) => ({ id, code: "X", message: i < 2 ? "Still being made." : i === 2 ? "Not found." : "Third reason." }));
    expect(bulkSummary({ done: [], skipped })).toBe("Done: 0. Left as they were: 4. Still being made. Not found.");
    expect(bulkSummary({ done: ["a"], skipped: [{ id: "x", code: "X", message: "  " }] })).toBe("Done: 1. Left as they were: 1.");
  });
});
