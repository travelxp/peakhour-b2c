import { trialNote, type SignupModeInput } from "@/lib/trial-copy";

/**
 * The words on /auth that are not the form: the panel beside it, and the ticks under the button.
 *
 * ★EVERY LINE IN THE PANEL IS A CLAIM THE OWNER APPROVED (`lib/seo/capabilities.ts`, docs/seo/EVIDENCE.md), shortened
 * and not widened. The first two are live; the last two are beta and say so.
 *
 * ★GENERIC, NOT SHOPIFY-FIRST (owner, 2026-11-16: "on /auth we are communicating that we are a Shopify assistant right in
 * the first card … the page needs more generic"). /auth is the door for every merchant, whatever they sell on, so the panel
 * is one card per area of the business, each an outcome. A channel is named only where the claim is about it: the shopping
 * assistant is live on Shopify and WhatsApp (WooCommerce is not yet), so the Sell line says so rather than "any store".
 * It replaced a "console" of five made-up
 * statuses ("3 leads in inbox", "Support: Inbox clear") that read as live data on a product nobody had used yet: there
 * is no lead inbox, Support is not live, and a picture of a day that never happened is not proof of one.
 * Nothing here is a number, and nothing is a price.
 */
export interface PanelItem {
  /** The pillar's dot: a --daylight-dot-* token name, so the colour stays in globals.css. */
  dot: "commerce" | "content" | "growth" | "presence";
  name: string;
  line: string;
  beta?: boolean;
}

export const PANEL_LIVE: readonly PanelItem[] = [
  {
    dot: "commerce",
    name: "Sell",
    line: "Answers shoppers from your catalogue on WhatsApp and on your Shopify store, and confirms cash-on-delivery orders.",
  },
  { dot: "content", name: "Publish", line: "Drafts posts and newsletters in your brand’s voice, for you to approve." },
];

export const PANEL_BETA: readonly PanelItem[] = [
  { dot: "presence", name: "Get found on Google", line: "Prepares changes to your Google Business Profile. Nothing is sent until you approve.", beta: true },
  { dot: "growth", name: "Grow with Peakhour Summit", line: "Reviews your growth decisions with a case for, a case against and safety checks. It only recommends.", beta: true },
];

/** The line under the panel: the promise that holds for every card above it. */
export const PANEL_PROMISE = "You approve what goes out.";

/**
 * The ticks under the primary button. ★A TRIAL ONLY WHEN THE CATALOG GIVES ONE (`trialNote`, owner rule 2026-10-06):
 * no `trialDays`, no trial line, and "no credit card" travels with the trial because the signup trial collects none.
 * The second tick is about access: open signups are live the same day, a gated platform emails the link on approval.
 */
export function signupTicks(trialDays: number | null, preLaunch: boolean, mode: SignupModeInput): readonly string[] {
  const note = trialNote(trialDays, mode);
  return [...(note ? [note] : []), preLaunch ? "We’ll email your link" : "Live the same day"];
}
