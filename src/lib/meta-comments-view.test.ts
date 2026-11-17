import { describe, it, expect } from "vitest";
import { ApiError } from "@/lib/api";
import type { MetaComment, MetaCommentPage } from "@/lib/api/meta-engagement";
import {
  appendReplies,
  authorLabel,
  canHide,
  commentsErrorMessage,
  countComments,
  hasUnloadedReplies,
  hiddenCount,
  hideLabel,
  loadFailure,
  patchHidden,
  postLabel,
  removeComment,
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
  repliesCursor: null,
  ...over,
});
const page = (comments: MetaComment[]): MetaCommentPage => ({ comments, nextCursor: null });

describe("counts", () => {
  const list = [c({ replies: [c({ id: "2", isHidden: true }), c({ id: "3" })] }), c({ id: "4", isHidden: true })];
  it("counts replies as comments", () => expect(countComments(list)).toBe(4));
  it("counts hidden ones at every depth", () => expect(hiddenCount(list)).toBe(2));
  it("an empty list is zero", () => {
    expect(countComments([])).toBe(0);
    expect(hiddenCount([])).toBe(0);
  });
  it("a list is partial while any comment still has replies on Meta's side", () => {
    expect(hasUnloadedReplies(list)).toBe(false);
    expect(hasUnloadedReplies([c({ replies: [c({ id: "2", repliesCursor: "R" })] })])).toBe(true);
    expect(hasUnloadedReplies([c({ repliesCursor: "R" })])).toBe(true);
  });
});

describe("labels", () => {
  it("the hide button says what it will do", () => {
    expect(hideLabel(c())).toBe("Hide");
    expect(hideLabel(c({ isHidden: true }))).toBe("Unhide");
  });
  it("a hidden comment can always be unhidden, even when Meta says it cannot be hidden", () => {
    expect(canHide(c({ isHidden: true, canHide: false }))).toBe(true);
    expect(canHide(c({ isHidden: false, canHide: false }))).toBe(false);
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
  it("counts UTF-16 units like the api's own limit, so an emoji is two", () => {
    expect(replyBlocker("\u{1F600}".repeat(1100), "instagram")).toBeNull();
    expect(replyBlocker("\u{1F600}".repeat(1101), "instagram")).toContain("2,200");
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
  it("the api's reconnect codes point at Connected accounts and never show the raw text", () => {
    for (const code of ["NEEDS_REAUTH", "META_PERMISSION_MISSING", "CAPABILITY_SCOPE_MISSING"]) {
      const m = commentsErrorMessage(e(code, 409, "(#200) Requires pages_manage_engagement permission"), "x");
      expect(m).toContain("Connected accounts");
      expect(m).not.toContain("#200");
    }
  });
  it("rate limits and an unreachable Meta say try again", () => {
    expect(commentsErrorMessage(e("RATE_LIMITED", 429), "x")).toContain("minute");
    expect(commentsErrorMessage(e("META_UNAVAILABLE", 502), "x")).toContain("Try again");
  });
  it("a code with no wording of its own is never decided by its message text", () => {
    expect(commentsErrorMessage(e("META_ERROR", 400, "needs permission"), "Could not")).toBe("Could not (reference req_1)");
    expect(commentsErrorMessage(e("OPERATION_FAILED"), "Could not")).toBe("Could not (reference req_1)");
    expect(commentsErrorMessage(new Error("boom"), "Could not")).toBe("Could not");
  });
});

describe("loadFailure", () => {
  const e = (code: string, status = 400) => new ApiError(code, "raw", status);
  it("a reconnect problem offers Reconnect and no retry", () => {
    expect(loadFailure(e("NEEDS_REAUTH", 409), "your accounts")).toMatchObject({ reconnect: true, retry: false, title: "Reconnect Meta to continue" });
  });
  it("a transient failure, or no answer at all, is a retry and does not say 'not available'", () => {
    for (const err of [e("RATE_LIMITED", 429), e("META_UNAVAILABLE", 502), new TypeError("Failed to fetch")]) {
      const f = loadFailure(err, "your accounts");
      expect(f).toMatchObject({ reconnect: false, retry: true });
      expect(f.title).toBe("Could not load your accounts");
    }
  });
  it("a settled refusal is a retry with its own words", () => {
    const f = loadFailure(e("META_NOT_CONNECTED", 404), "your accounts");
    expect(f.retry).toBe(true);
    expect(f.title).toBe("Your accounts are not available");
    expect(f.description).toContain("Connect");
  });
});

describe("patching loaded pages in place", () => {
  const pages = [page([c({ id: "a", replies: [c({ id: "a1" })], repliesCursor: "R1" }), c({ id: "b" })]), page([c({ id: "d" })])];
  it("hides one comment, at any depth and on any page, and leaves the rest as they were", () => {
    const next = patchHidden(pages, "a1", true);
    expect(next[0]!.comments[0]!.replies[0]!.isHidden).toBe(true);
    expect(next[0]!.comments[1]).toEqual(pages[0]!.comments[1]);
    expect(next[1]!.comments[0]!.isHidden).toBe(false);
    expect(patchHidden(pages, "d", true)[1]!.comments[0]!.isHidden).toBe(true);
    expect(pages[0]!.comments[0]!.replies[0]!.isHidden).toBe(false);
  });
  it("removes a comment with its replies, or just a reply", () => {
    expect(removeComment(pages, "a")[0]!.comments.map((x) => x.id)).toEqual(["b"]);
    expect(removeComment(pages, "a1")[0]!.comments[0]!.replies).toEqual([]);
  });
  it("appends the next replies, skips ones already shown, and moves the cursor", () => {
    const next = appendReplies(pages, "a", [c({ id: "a1" }), c({ id: "a2" })], null);
    expect(next[0]!.comments[0]!.replies.map((x) => x.id)).toEqual(["a1", "a2"]);
    expect(next[0]!.comments[0]!.repliesCursor).toBeNull();
    expect(hasUnloadedReplies(next[0]!.comments)).toBe(false);
  });
});
