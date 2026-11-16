import { trialNote, type SignupModeInput } from "@/lib/trial-copy";

/**
 * The words on /auth that are not the form: the panel beside it, and the ticks under the button.
 *
 * ★EVERY LINE IN THE PANEL IS AN APPROVED CLAIM (`lib/seo/capabilities.ts`), SHORTENED AND NEVER WIDENED. Each card names
 * the claim ids it rests on (`claims`), and auth-copy.test.ts fails if one is missing, unapproved, or not live (beta for the
 * beta list). Shortened means: drop detail, never add scope. "Asks the shopper to confirm" may not become "confirms";
 * "an admin on your team approves" may not become "you approve"; "proposals" may not become "decisions".
 *
 * ★GENERIC, NOT SHOPIFY-FIRST (owner, 2026-11-16: "on /auth we are communicating that we are a Shopify assistant right in
 * the first card … the page needs more generic"). /auth is the door for every merchant, so the headline names what Peakhour
 * does, not where, and each card is named for an area of work ("Sell", "Publish"), never for a channel. A channel appears
 * only inside a line whose claim is about it: the shopping assistant, COD and shelves are live on Shopify (WooCommerce is
 * not yet), so those lines say Shopify rather than "any store" — honest, and no longer the panel's identity.
 *
 * The panel replaced a "console" of five made-up statuses ("3 leads in inbox", "Support: Inbox clear") that read as live
 * data on a product nobody had used yet. Nothing here is a number, and nothing is a price.
 */
export interface PanelItem {
  /** The pillar's dot: a --daylight-dot-* token name, so the colour stays in globals.css. */
  dot: "commerce" | "content" | "growth" | "presence";
  name: string;
  line: string;
  /** The approved claim ids (capabilities.ts) the line shortens. */
  claims: readonly string[];
  beta?: boolean;
}

/** The panel's headline: what Peakhour does, not where it runs. */
export const PANEL_HEADLINE = { lead: "One AI team for how you ", mark: "sell, publish and get found", tail: "." } as const;

export const PANEL_LIVE: readonly PanelItem[] = [
  {
    dot: "commerce",
    name: "Sell",
    line: "Answers shoppers from your real catalogue in your Shopify store, and sends a checkout link when they buy on WhatsApp.",
    claims: ["commerce.ai_shopping_assistant.answers_from_catalogue", "commerce.whatsapp_shopping.checkout_link"],
  },
  {
    dot: "commerce",
    name: "Confirm orders",
    line: "Asks shoppers on WhatsApp to confirm or cancel each cash-on-delivery order from your Shopify store.",
    claims: ["commerce.cod_confirmation.ask_on_whatsapp"],
  },
  {
    dot: "commerce",
    name: "Merchandise",
    line: "Builds product shelves that sell, inside Shopify.",
    claims: ["commerce.product_recommendations.shelves"],
  },
  {
    dot: "content",
    name: "Publish",
    line: "Learns how your brand writes, and posts what you approve to LinkedIn, X, Facebook and Instagram.",
    claims: ["content.brand_voice.learns_your_voice", "content.social_publishing.four_networks"],
  },
];

/** Two cards, not three to six: these are the only two beta capabilities a merchant can use today. */
export const PANEL_BETA: readonly PanelItem[] = [
  {
    dot: "presence",
    name: "Get found on Google",
    line: "Prepares changes to your Google Business Profile. Nothing is sent to Google until an admin on your team approves it.",
    claims: ["presence.gbp_management.prepare_and_approve"],
    beta: true,
  },
  {
    dot: "growth",
    name: "Grow with Peakhour Summit",
    line: "Reviews your growth proposals with a case for, a case against and safety checks. It only recommends.",
    claims: ["growth.peakhour_summit.reviews_proposals"],
    beta: true,
  },
];

/**
 * The line under the panel, true of every card: the assistant answers shoppers on its own, while shelves, posts, profile
 * changes and growth moves wait for approval unless the merchant turns on autonomy. So it promises the choice, not that
 * everything waits.
 */
export const PANEL_PROMISE = "You choose what waits for your approval and what runs on its own.";

/**
 * The ticks under the primary button. ★A TRIAL ONLY WHEN THE CATALOG GIVES ONE (`trialNote`, owner rule 2026-10-06):
 * no `trialDays`, no trial line, and "no credit card" travels with the trial because the signup trial collects none.
 * The second tick is about access: open signups are live the same day, a gated platform emails the link on approval.
 */
export function signupTicks(trialDays: number | null, preLaunch: boolean, mode: SignupModeInput): readonly string[] {
  const note = trialNote(trialDays, mode);
  return [...(note ? [note] : []), preLaunch ? "We’ll email your link" : "Live the same day"];
}
