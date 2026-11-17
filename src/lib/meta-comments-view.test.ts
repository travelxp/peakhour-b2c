import { describe, it, expect } from "vitest";
import { ApiError } from "@/lib/api";
import type { MetaComment } from "@/lib/api/meta-engagement";
import {
  authorLabel,
  commentsErrorMessage,
  countComments,
  hiddenCount,
  hideLabel,
  postLabel,
  replyBlocker,
} from "./meta-comments-view";

const c = (over: Partial<MetaComment> = {}): MetaComment => ({
  id: "1",
  text: "hi",
  createdTime: "",
  isHidden: false,
  likeCount: 0,
  canHide: true,
  canRemove: true,
  replies: [],
  ...over,
});

describe("counts", () => {
  const list = [c({ replies: [c({ id: "2", isHidden: true }), c({ id: "3" })] }), c({ id: "4", isHidden: true })];
  it("counts replies as comments", () => expect(countComments(list)).toBe(4));
  it("counts hidden ones at every depth", () => expect(hiddenCount(list)).toBe(2));
  it("an empty list is zero", () => {
    expect(countComments([])).toBe(0);
    expect(hiddenCount([])).toBe(0);
  });
});

describe("labels", () => {
  it("the hide button says what it will do", () => {
    expect(hideLabel(c())).toBe("Hide");
    expect(hideLabel(c({ isHidden: true }))).toBe("Unhide");
  });
  it("a missing author is Someone, never blank", () => {
    expect(authorLabel(c())).toBe("Someone");
    expect(authorLabel(c({ authorName: "  " }))).toBe("Someone");
    expect(authorLabel(c({ authorName: "Asha" }))).toBe("Asha");
  });
  it("a post is named by its first words", () => {
    expect(postLabel(undefined, "Post")).toBe("Post without text");
    expect(postLabel("  a\n b  ", "Post")).toBe("a b");
    const long = postLabel("x".repeat(200), "Post", 10);
    expect(long).toHaveLength(10);
    expect(long.endsWith("…")).toBe(true);
  });
});

describe("replyBlocker", () => {
  it("blocks an empty or blank reply", () => {
    expect(replyBlocker("   ", "facebook")).not.toBeNull();
    expect(replyBlocker("Thanks", "facebook")).toBeNull();
  });
  it("Instagram's limit is lower than Facebook's", () => {
    const t = "a".repeat(3000);
    expect(replyBlocker(t, "instagram")).toContain("2,200");
    expect(replyBlocker(t, "facebook")).toBeNull();
  });
});

describe("commentsErrorMessage", () => {
  const e = (code: string, status = 400, message = "raw") => new ApiError(code, message, status, "req_1");
  it("known codes read as plain English", () => {
    expect(commentsErrorMessage(e("META_NOT_CONNECTED", 404), "x")).toContain("Connect");
    expect(commentsErrorMessage(e("FORBIDDEN", 403), "x")).toContain("admin");
    expect(commentsErrorMessage(e("COMMENT_NOT_FOUND", 404), "x")).toContain("gone");
  });
  it("a Meta permission problem points at Integrations and never shows Meta's text", () => {
    const m = commentsErrorMessage(e("META_ERROR", 403, "(#200) Requires pages_manage_engagement permission"), "x");
    expect(m).toContain("Connected accounts");
    expect(m).not.toContain("#200");
  });
  it("rate limits ask for a minute", () => {
    expect(commentsErrorMessage(e("META_ERROR", 429, "Rate limited"), "x")).toContain("minute");
  });
  it("anything else shows the fallback and the reference, not the raw message", () => {
    expect(commentsErrorMessage(e("OPERATION_FAILED"), "Could not")).toBe("Could not (reference req_1)");
    expect(commentsErrorMessage(new Error("boom"), "Could not")).toBe("Could not");
  });
});
