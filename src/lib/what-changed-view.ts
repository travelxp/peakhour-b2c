import { actionCostShort, type ActionCost } from "@/lib/action-cost";
import type { ChannelWhatChanged } from "@/lib/api/what-changed";

/**
 * Words and rules for "What changed in your posts" and its "Draft this post" button, kept out of the components so they can be tested.
 */

export const DRAFT_BUTTON_LABEL = "Draft this post";

/**
 * The button's label and whether it may be pressed. The price is shown BEFORE anything runs, in Peaks, and a button with no price in hand does not
 * run: while the rate card loads, or when it has no row for the action, the button is off and says why rather than risk spending Peaks unquoted.
 */
export function draftButtonState(cost: ActionCost): { label: string; enabled: boolean; hint: string } {
  const price = actionCostShort(cost);
  if (cost.state === "priced" || cost.state === "free") {
    return {
      label: `${DRAFT_BUTTON_LABEL} · ${price}`,
      enabled: true,
      hint:
        cost.state === "free"
          ? "Writes a draft for you to check. Nothing is posted until you publish or schedule it."
          : `Writes a draft for you to check, for ${price}. You are charged when the draft arrives. Nothing is posted until you publish or schedule it.`,
    };
  }
  return {
    label: DRAFT_BUTTON_LABEL,
    enabled: false,
    hint: cost.state === "loading" ? "Checking the price…" : "We cannot show the price right now, so this is switched off. Try again shortly.",
  };
}

/** What to say on a channel with no lines. The honest answer when there is too little to go on. */
export function emptyNote(c: Pick<ChannelWhatChanged, "state" | "measuredPosts" | "needed" | "name">): string {
  if (c.state === "steady") return `Nothing has changed enough on ${c.name} to mention.`;
  const have = c.measuredPosts === 1 ? "1 post" : `${c.measuredPosts} posts`;
  return `Not enough history yet. We compare ${c.needed} or more posts with results from the last 28 days against the 28 before; you have ${have} so far.`;
}

export const GROUP_TITLE: Record<"improving" | "declining" | "attention", string> = {
  improving: "Improving",
  declining: "Declining",
  attention: "Needs attention",
};
