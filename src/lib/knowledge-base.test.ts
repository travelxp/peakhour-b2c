import { describe, it, expect } from "vitest";
import {
  KB_CONTENT_MAX,
  KB_TAGS_MAX,
  KB_TAG_MAX,
  KB_TITLE_MAX,
  answerToPayload,
  askedLine,
  channelsLine,
  entryToForm,
  formToPayload,
  kbErrorMessage,
  parseTags,
  readOnlyNote,
  sourceLabel,
  type KbEntry,
} from "./knowledge-base";

const entry = (over: Partial<KbEntry> = {}): KbEntry => ({
  id: "1",
  title: "Returns",
  content: "30 days.",
  tags: ["returns", "refund"],
  source: "owner",
  status: "active",
  channels: [],
  readOnly: false,
  managedIn: null,
  url: null,
  syncedAt: null,
  createdAt: null,
  updatedAt: null,
  ...over,
});

describe("bounds match the api (services/kb/kb-editor.ts, biz_kb.zod.ts)", () => {
  it("are 256 / 8192 / 32 tags of 64", () => {
    expect([KB_TITLE_MAX, KB_CONTENT_MAX, KB_TAGS_MAX, KB_TAG_MAX]).toEqual([256, 8192, 32, 64]);
  });
});

describe("parseTags", () => {
  it("splits on commas and newlines, trims, drops blanks and repeats", () => {
    expect(parseTags(" a, b ,,a\nc ")).toEqual(["a", "b", "c"]);
    expect(parseTags("")).toEqual([]);
  });
});

describe("formToPayload", () => {
  const ok = { title: " Hours ", content: " 9-5 ", tags: "a, b", channels: ["shopify"] };
  it("accepts a valid form, trimmed", () => {
    expect(formToPayload(ok)).toEqual({ ok: true, payload: { title: "Hours", content: "9-5", tags: ["a", "b"], channels: ["shopify"] } });
  });
  it("accepts exactly the bounds", () => {
    const r = formToPayload({ title: "t".repeat(KB_TITLE_MAX), content: "c".repeat(KB_CONTENT_MAX), tags: Array.from({ length: KB_TAGS_MAX }, (_, i) => `t${i}`).join(","), channels: [] });
    expect(r.ok).toBe(true);
  });
  it.each([
    ["empty title", { ...ok, title: "  " }, "title"],
    ["long title", { ...ok, title: "t".repeat(KB_TITLE_MAX + 1) }, "title"],
    ["empty answer", { ...ok, content: "" }, "content"],
    ["long answer", { ...ok, content: "c".repeat(KB_CONTENT_MAX + 1) }, "content"],
    ["too many tags", { ...ok, tags: Array.from({ length: KB_TAGS_MAX + 1 }, (_, i) => `t${i}`).join(",") }, "tags"],
    ["a long tag", { ...ok, tags: "x".repeat(KB_TAG_MAX + 1) }, "tags"],
  ])("refuses %s and names the field", (_n, form, field) => {
    const r = formToPayload(form);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.field).toBe(field);
  });
});

describe("answerToPayload", () => {
  it("needs an answer, within the bound", () => {
    expect(answerToPayload("  Yes  ")).toEqual({ ok: true, payload: { content: "Yes" } });
    expect(answerToPayload("  ").ok).toBe(false);
    expect(answerToPayload("c".repeat(KB_CONTENT_MAX + 1)).ok).toBe(false);
    expect(answerToPayload("c".repeat(KB_CONTENT_MAX)).ok).toBe(true);
  });
});

describe("copy", () => {
  it("entryToForm round-trips tags and channels", () => {
    expect(entryToForm(entry({ channels: ["shopify"] }))).toEqual({ title: "Returns", content: "30 days.", tags: "returns, refund", channels: ["shopify"] });
  });
  it("channelsLine says All channels for none", () => {
    expect(channelsLine([])).toBe("All channels");
    expect(channelsLine(["shopify", "woocommerce"])).toBe("Shopify, WooCommerce");
    expect(channelsLine(["etsy"])).toBe("etsy");
  });
  it("sourceLabel names where it came from", () => {
    expect(sourceLabel({ source: "owner", managedIn: null })).toBe("Written by you");
    expect(sourceLabel({ source: "import", managedIn: "Shopify" })).toBe("Imported from Shopify");
    expect(sourceLabel({ source: "learned", managedIn: null })).toBe("Learned from a conversation");
  });
  it("readOnlyNote exists only for an imported entry, and says it is managed in Shopify", () => {
    expect(readOnlyNote({ readOnly: false, managedIn: null })).toBeNull();
    expect(readOnlyNote({ readOnly: true, managedIn: "Shopify" })).toContain("Managed in Shopify");
    expect(readOnlyNote({ readOnly: true, managedIn: "Shopify" })).toContain("Take it over");
  });
  it("askedLine pluralises", () => {
    expect(askedLine({ timesAsked: 1 })).toBe("Asked once");
    expect(askedLine({ timesAsked: 4 })).toBe("Asked 4 times");
  });
  it("kbErrorMessage uses the api's sentence, else a default", () => {
    expect(kbErrorMessage(new Error("This question has already been answered or dismissed"))).toBe("This question has already been answered or dismissed");
    expect(kbErrorMessage(undefined)).toContain("did not save");
  });
});
