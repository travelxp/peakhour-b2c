import { describe, it, expect } from "vitest";
import { firstCommentNote, firstCommentRuleOf } from "./first-comment";
import { buildMetaChannel } from "./meta-compose";
import type { MediaRule } from "./media-rules";

// the shape GET /v1/media/rules answers: the post row of a channel that takes a first comment carries it
const RULES: MediaRule[] = [
  { key: "post:facebook", label: "a Facebook post", firstComment: { maxLength: 2000 } },
  { key: "post:x", label: "an X post", firstComment: { maxLength: 280 } },
  { key: "post:threads", label: "a Threads post" },
  { key: "presence:googlebusiness", label: "your listing" },
];

describe("firstCommentRuleOf reads the api's table, not a channel list", () => {
  it("returns the row's rule for a post channel", () => {
    expect(firstCommentRuleOf(RULES, "facebook")).toEqual({ maxLength: 2000 });
    expect(firstCommentRuleOf(RULES, "x")).toEqual({ maxLength: 280 });
  });
  it("is undefined for a channel whose row has none, a channel with no row, and a table not loaded", () => {
    expect(firstCommentRuleOf(RULES, "threads")).toBeUndefined();
    expect(firstCommentRuleOf(RULES, "googlebusiness")).toBeUndefined();
    expect(firstCommentRuleOf(RULES, "linkedin")).toBeUndefined();
    expect(firstCommentRuleOf(undefined, "facebook")).toBeUndefined();
  });
  it("a channel that gains the rule on the api shows it with no change here", () => {
    expect(firstCommentRuleOf(RULES.map((r) => (r.key === "post:threads" ? { ...r, firstComment: { maxLength: 500 } } : r)), "threads")).toEqual({ maxLength: 500 });
  });
});

describe("firstCommentNote", () => {
  it("says nothing when there was no first comment", () => {
    expect(firstCommentNote(undefined, undefined)).toBeUndefined();
  });
  it("says the post is live when the comment failed or was skipped, with the reason", () => {
    expect(firstCommentNote("posted", undefined)).toEqual({ tone: "ok", text: "The first comment was posted." });
    expect(firstCommentNote("failed", "(#200) Permissions error")).toEqual({ tone: "warn", text: "The post is live, but the first comment was not posted: (#200) Permissions error" });
    expect(firstCommentNote("skipped", undefined)?.text).toContain("The post is live.");
  });
});

describe("buildMetaChannel carries the first comment only when there is one", () => {
  const base = { text: "Fresh stock", media: [{ url: "https://cdn.example.com/a.jpg", mime: "image/jpeg" }], link: "" };
  it("adds it trimmed", () => {
    expect(buildMetaChannel("facebook", { ...base, firstComment: "  Link below  " }).payload).toMatchObject({ firstComment: "Link below" });
  });
  it("leaves the key out when blank or absent", () => {
    expect(buildMetaChannel("facebook", { ...base, firstComment: "   " }).payload).not.toHaveProperty("firstComment");
    expect(buildMetaChannel("facebook", base).payload).not.toHaveProperty("firstComment");
  });
});
