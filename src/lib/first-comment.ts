import type { MediaRule } from "@/lib/media-rules";
import { destinationKey } from "@/lib/media-rules";

/** What a channel takes as a first comment, from the api's rules table; undefined when its API allows none (or the table is not loaded yet). */
export function firstCommentRuleOf(rules: MediaRule[] | undefined, channel: string): { maxLength: number } | undefined {
  return rules?.find((r) => r.key === destinationKey({ kind: "post", channel }))?.firstComment;
}

/** How a published post's first comment went, in a sentence a merchant reads; undefined when there is nothing to say. */
export function firstCommentNote(status: string | undefined, reason: string | undefined): { tone: "ok" | "warn"; text: string } | undefined {
  if (status === "posted") return { tone: "ok", text: "The first comment was posted." };
  if (status === "failed") return { tone: "warn", text: `The post is live, but the first comment was not posted${reason ? `: ${reason}` : "."}` };
  if (status === "skipped") return { tone: "warn", text: `The post is live. The first comment was not posted${reason ? `: ${reason}` : "."}` };
  return undefined;
}
