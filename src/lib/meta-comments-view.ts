import { ApiError } from "@/lib/api";
import { navLabel } from "@/lib/nav-copy";
import type { MetaComment, MetaCommentPage } from "@/lib/api/meta-engagement";

/** Plain-language rules for the Facebook and Instagram comments screens. Pure, so they can be tested without a browser. */

export type MetaCommentsPlatform = "facebook" | "instagram";

/** Every comment in a thread list, replies included. */
export function countComments(list: readonly MetaComment[]): number {
  return list.reduce((n, c) => n + 1 + countComments(c.replies), 0);
}

export function hiddenCount(list: readonly MetaComment[]): number {
  return list.reduce((n, c) => n + (c.isHidden ? 1 : 0) + hiddenCount(c.replies), 0);
}

/** Whether any comment still has replies Meta has not sent yet, so the screen never calls a partial list complete. */
export function hasUnloadedReplies(list: readonly MetaComment[]): boolean {
  return list.some((c) => c.repliesCursor !== null || hasUnloadedReplies(c.replies));
}

/** Who wrote it. Meta leaves the author out when it was not allowed to share it. */
export function authorLabel(c: MetaComment): string {
  return c.authorName?.trim() || "Someone";
}

export function hideLabel(c: MetaComment): "Hide" | "Unhide" {
  return c.isHidden ? "Unhide" : "Hide";
}

/** Meta tells a Page whether it may hide or delete a comment; an Instagram comment always can be. */
export function canHide(c: MetaComment): boolean {
  // An already-hidden comment can always be brought back, whatever Meta says about hiding it.
  return c.isHidden || c.canHide;
}
export function canDelete(c: MetaComment): boolean {
  return c.canRemove;
}

/** A post's one-line name in the list: its first words, never empty. */
export function postLabel(text: string | undefined, noun: string, max = 80): string {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  if (!flat) return `${noun} without text`;
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Why the Send button is off, or null when it can send. `.length` is UTF-16 units on purpose: it is what the api's own
 * limit counts, so a reply this accepts is one the api accepts.
 */
export function replyBlocker(text: string, platform: MetaCommentsPlatform): string | null {
  const t = text.trim();
  if (!t) return "Write a reply first.";
  const max = platform === "instagram" ? 2200 : 8000;
  if (t.length > max) return `Replies are limited to ${max.toLocaleString("en-US")} characters.`;
  return null;
}

export const DELETE_WARNING =
  "This removes the comment from the post for everyone. It cannot be undone. Hide it instead if you only want it off the post.";

export const ADMIN_ONLY = "Only an owner or admin can reply, hide or delete comments.";

const ACCOUNTS = navLabel("/dashboard/integrations");
const PERMISSION_HELP = `Meta has not given Peakhour permission for this yet. Reconnect Facebook in ${ACCOUNTS} and accept every request.`;
const REAUTH_HELP = `Your Meta connection needs to be reconnected. Do that in ${ACCOUNTS}.`;

/** Codes whose fix is to reconnect Meta. */
const RECONNECT_CODES = new Set(["NEEDS_REAUTH", "META_PERMISSION_MISSING", "CAPABILITY_SCOPE_MISSING"]);
/** Codes that pass on their own: try again. */
const TRANSIENT_CODES = new Set(["RATE_LIMITED", "META_UNAVAILABLE"]);

const BY_CODE: Record<string, string> = {
  META_NOT_CONNECTED: `Connect Facebook and Instagram in ${ACCOUNTS} first.`,
  CAPABILITY_DISABLED: `This is switched off for your account in ${ACCOUNTS}.`,
  PAGE_NOT_FOUND: "That Page is not on your connection any more.",
  POST_NOT_FOUND: "That post is not on this Page, or it was deleted.",
  MEDIA_NOT_FOUND: "That post is not on this Instagram account, or it was deleted.",
  IG_NOT_FOUND: "That Instagram account is not linked to your Pages.",
  COMMENT_NOT_FOUND: "That comment is gone. It may have been deleted already.",
  NEEDS_REAUTH: REAUTH_HELP,
  CAPABILITY_SCOPE_MISSING: PERMISSION_HELP,
  META_PERMISSION_MISSING: PERMISSION_HELP,
  RATE_LIMITED: "Meta is asking us to slow down. Try again in a minute.",
  META_UNAVAILABLE: "We could not reach Meta just now. Try again in a moment.",
  FORBIDDEN: ADMIN_ONLY,
};

/** What to tell the merchant, in our words. The api's own message and Meta's are never shown. */
export function commentsErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  if (BY_CODE[err.code]) return BY_CODE[err.code]!;
  return err.requestId ? `${fallback} (reference ${err.requestId})` : fallback;
}

/** What a screen that failed to load should offer: a Reconnect, or a Try again. `what` is a plural noun, like "comments". */
export function loadFailure(err: unknown, what: string): { title: string; description: string; reconnect: boolean; retry: boolean } {
  const code = err instanceof ApiError ? err.code : "";
  const reconnect = RECONNECT_CODES.has(code);
  // A network failure (no ApiError at all) is as transient as Meta asking us to wait.
  const transient = !(err instanceof ApiError) || TRANSIENT_CODES.has(code);
  return {
    title: reconnect ? "Reconnect Meta to continue" : transient ? `Could not load ${what}` : `${what[0]!.toUpperCase()}${what.slice(1)} are not available`,
    description: commentsErrorMessage(err, `We could not load ${what}. Try again in a moment.`),
    reconnect,
    retry: !reconnect,
  };
}

// ── patching the loaded pages in place (react-query InfiniteData.pages) ─────────────────────────────────────────

type Pages = readonly MetaCommentPage[];

function mapTree(list: readonly MetaComment[], id: string, fn: (c: MetaComment) => MetaComment | null): MetaComment[] {
  const out: MetaComment[] = [];
  for (const c of list) {
    if (c.id === id) {
      const next = fn(c);
      if (next) out.push(next);
    } else {
      out.push({ ...c, replies: mapTree(c.replies, id, fn) });
    }
  }
  return out;
}

const mapPages = (pages: Pages, id: string, fn: (c: MetaComment) => MetaComment | null): MetaCommentPage[] =>
  pages.map((p) => ({ ...p, comments: mapTree(p.comments, id, fn) }));

/** Hide or unhide one comment without refetching anything. */
export function patchHidden(pages: Pages, id: string, hidden: boolean): MetaCommentPage[] {
  return mapPages(pages, id, (c) => ({ ...c, isHidden: hidden }));
}

/** Drop one comment (and, with it, its replies). */
export function removeComment(pages: Pages, id: string): MetaCommentPage[] {
  return mapPages(pages, id, () => null);
}

/** Add the next page of replies under one comment and move its cursor. */
export function appendReplies(pages: Pages, id: string, more: readonly MetaComment[], cursor: string | null): MetaCommentPage[] {
  return mapPages(pages, id, (c) => {
    const have = new Set(c.replies.map((r) => r.id));
    return { ...c, replies: [...c.replies, ...more.filter((r) => !have.has(r.id))], repliesCursor: cursor };
  });
}
