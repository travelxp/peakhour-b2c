import { trialNote, type SignupModeInput } from "@/lib/trial-copy";

/**
 * The words on /auth that are not the form: the panel beside it, and the ticks under the button.
 *
 * ★EVERY LINE IN THE PANEL IS A CLAIM THE OWNER APPROVED (`lib/seo/capabilities.ts`, docs/seo/EVIDENCE.md), shortened
 * and not widened. The first four are live; the last two are beta and say so. It replaced a "console" of five made-up
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
  { dot: "commerce", name: "Shopify assistant", line: "Answers shoppers from your real catalogue, inside Shopify." },
  { dot: "commerce", name: "COD confirmation", line: "Asks the shopper on WhatsApp to confirm or cancel each cash-on-delivery order." },
  { dot: "commerce", name: "Smart Rails", line: "Product shelves in your theme. Changes the engine suggests wait for your approval." },
  { dot: "content", name: "Brand voice", line: "Learns how your brand writes, and drafts in that voice." },
];

export const PANEL_BETA: readonly PanelItem[] = [
  { dot: "presence", name: "Google Business Profile", line: "Prepare changes to your listing. Nothing is sent to Google until an admin approves.", beta: true },
  { dot: "growth", name: "Peakhour Summit", line: "Reviews your growth proposals with a case for, a case against and safety checks. It only recommends.", beta: true },
];

/**
 * The ticks under the primary button. ★A TRIAL ONLY WHEN THE CATALOG GIVES ONE (`trialNote`, owner rule 2026-10-06):
 * no `trialDays`, no trial line, and "no credit card" travels with the trial because the signup trial collects none.
 * The second tick is about access: open signups are live the same day, a gated platform emails the link on approval.
 */
export function signupTicks(trialDays: number | null, preLaunch: boolean, mode: SignupModeInput): readonly string[] {
  const note = trialNote(trialDays, mode);
  return [...(note ? [note] : []), preLaunch ? "We’ll email your link" : "Live the same day"];
}
