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
 * does (only what is live), and each card is named for an area of work ("Publish", "Sell"), never for a channel or a
 * network. A channel appears only inside a line whose claim is about it: the shopping assistant, COD and shelves are live
 * on Shopify (WooCommerce is not yet), so those lines say Shopify rather than "any store", honest, and no longer the
 * panel's identity.
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

/**
 * The panel's headline: what Peakhour does, not where it runs, and only what is live (selling and publishing). "Get found"
 * and "grow" are beta, so they are cards under "In beta", never the headline's promise.
 */
export const PANEL_HEADLINE = { lead: "One AI team for ", mark: "selling and publishing", tail: "." } as const;

/**
 * Publishing comes first so the panel does not open on a single store platform. One card per approved claim: two claims
 * joined in one sentence implied a link neither states (the review of #815 caught "Sell" suggesting the store assistant
 * hands shoppers to WhatsApp checkout).
 */
export const PANEL_LIVE: readonly PanelItem[] = [
  {
    dot: "content",
    name: "Publish",
    line: "Learns how your brand writes, and posts approved content to LinkedIn, X, Facebook and Instagram.",
    claims: ["content.brand_voice.learns_your_voice", "content.social_publishing.four_networks"],
  },
  {
    dot: "commerce",
    name: "Sell",
    line: "Answers shoppers from your real catalogue, inside your Shopify store.",
    claims: ["commerce.ai_shopping_assistant.answers_from_catalogue"],
  },
  {
    dot: "commerce",
    name: "Checkout",
    line: "When a shopper agrees to buy on WhatsApp, sends them a checkout or payment link.",
    claims: ["commerce.whatsapp_shopping.checkout_link"],
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
];

/** Two cards, not three to six: these are the only two beta capabilities a merchant can use today. */
export const PANEL_BETA: readonly PanelItem[] = [
  {
    dot: "presence",
    name: "Get found",
    line: "Prepares changes to your Google Business Profile. Nothing is sent to Google until an admin on your team approves it.",
    claims: ["presence.gbp_management.prepare_and_approve"],
    beta: true,
  },
  {
    dot: "growth",
    name: "Grow",
    line: "Peakhour Summit reviews your growth proposals with a case for, a case against and safety checks. It only recommends.",
    claims: ["growth.peakhour_summit.reviews_proposals"],
    beta: true,
  },
];

// No closing promise line: no single sentence is true of every card (the assistant answers on its own, Google profile
// changes always wait for an admin, Summit only recommends), and each card already states its own limit.

/**
 * The ticks under the primary button. ★A TRIAL ONLY WHEN THE CATALOG GIVES ONE (`trialNote`, owner rule 2026-10-06):
 * no `trialDays`, no trial line, and "no credit card" travels with the trial because the signup trial collects none.
 * The second tick is about access: open signups are live the same day, a gated platform emails the link on approval.
 */
export function signupTicks(trialDays: number | null, preLaunch: boolean, mode: SignupModeInput): readonly string[] {
  const note = trialNote(trialDays, mode);
  return [...(note ? [note] : []), preLaunch ? "We’ll email your link" : "Live the same day"];
}
