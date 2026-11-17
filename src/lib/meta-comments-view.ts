import { ApiError } from "@/lib/api";
import { navLabel } from "@/lib/nav-copy";
import type { MetaComment } from "@/lib/api/meta-engagement";

/** Plain-language rules for the Facebook and Instagram comments screens. Pure, so they can be tested without a browser. */

export type MetaCommentsPlatform = "facebook" | "instagram";

/** Every comment in a thread list, replies included. */
export function countComments(list: readonly MetaComment[]): number {
  return list.reduce((n, c) => n + 1 + countComments(c.replies), 0);
}

export function hiddenCount(list: readonly MetaComment[]): number {
  return list.reduce((n, c) => n + (c.isHidden ? 1 : 0) + hiddenCount(c.replies), 0);
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

/** Why the Send button is off, or null when it can send. */
export function replyBlocker(text: string, platform: MetaCommentsPlatform): string | null {
  const t = text.trim();
  if (!t) return "Write a reply first.";
  const max = platform === "instagram" ? 2200 : 8000;
  if ([...t].length > max) return `Replies are limited to ${max.toLocaleString("en-US")} characters.`;
  return null;
}

export const DELETE_WARNING =
  "This removes the comment from the post for everyone. It cannot be undone. Hide it instead if you only want it off the post.";

const ACCOUNTS = navLabel("/dashboard/integrations");
const PERMISSION_HELP = `Meta has not given Peakhour permission for this yet. Reconnect Facebook in ${ACCOUNTS} and accept every request.`;

const BY_CODE: Record<string, string> = {
  META_NOT_CONNECTED: `Connect Facebook and Instagram in ${ACCOUNTS} first.`,
  CAPABILITY_DISABLED: `This is switched off for your account in ${ACCOUNTS}.`,
  PAGE_NOT_FOUND: "That Page is not on your connection any more.",
  POST_NOT_FOUND: "That post is not on this Page.",
  MEDIA_NOT_FOUND: "That post is not on this Instagram account.",
  IG_NOT_FOUND: "That Instagram account is not linked to your Pages.",
  COMMENT_NOT_FOUND: "That comment is gone. It may have been deleted already.",
  CAPABILITY_SCOPE_MISSING: PERMISSION_HELP,
  META_PERMISSION_MISSING: PERMISSION_HELP,
  META_AUTH_EXPIRED: `Your Meta sign-in has expired. Reconnect Facebook in ${ACCOUNTS}.`,
  FORBIDDEN: "Only an admin can reply, hide or delete comments.",
};

/** What to tell the merchant, in our words. Meta's own message is never shown. */
export function commentsErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  if (BY_CODE[err.code]) return BY_CODE[err.code]!;
  if (err.code === "META_ERROR") {
    if (/permission/i.test(err.message)) {
      return PERMISSION_HELP;
    }
    if (err.status === 429) return "Meta is asking us to slow down. Try again in a minute.";
  }
  return err.requestId ? `${fallback} (reference ${err.requestId})` : fallback;
}
