import type { RateCardUseCase } from "@/hooks/use-credits";
import { formatPeaks } from "@/lib/pricing";

/**
 * What a button will cost, said beside the button, before it is pressed.
 *
 * ── WHY ONE TABLE ─────────────────────────────────────────────────────────
 *
 * Buttons that spend Peaks said "Uses Peaks." (a sentence with no number), or
 * said nothing at all. Each place that wanted to do better would have had to
 * pick the rate-card row itself, which is how a screen ends up quoting a price
 * the act does not charge. So the mapping from "the thing a person presses" to
 * "the rate-card row it bills" lives here, once, and the NUMBER is always read
 * off the rate card (`/v1/dashboard/credits/rate-card`), never typed in a
 * component. A repriced row changes every button the next time the card loads.
 *
 * ── THE RULE FOR MORE THAN ONE ROW ─────────────────────────────────────────
 *
 * One act is one charge, and when an act touches several rows the api charges
 * the dearest (`collapseFanOut`). So a list here is priced at its dearest row,
 * and the sentence says "up to" when the rows differ.
 *
 * ── THE FOUR STATES ───────────────────────────────────────────────────────
 *
 * `loading` and `unknown` are NOT `free`. A rate card that has not arrived says
 * we do not know yet; a row it does not carry says we cannot price this. Neither
 * may be shown as a price, and neither may be shown as Free.
 */
export const ACTION_USE_CASES = {
  /** The Ask page. */
  ask: ["ask_peakhour"],
  /** Generate pages (web pages from the business's own content). */
  webPages: ["compose_web_page"],
  /** Ask your inbox (a question over the business's own conversations). */
  askInbox: ["whatsapp.inbox_intelligence"],
  /** Commerce: the Pricer's weekly brief. */
  pricerBrief: ["commerce.pricer.brief"],
  /** Commerce: the Replenisher's restock brief. */
  replenisherBrief: ["commerce.replenisher.brief"],
  /** Commerce: a drafted reply to a review. */
  reviewReply: ["commerce.reputation.respond"],
  /** Commerce: the review analysis. */
  reviewAnalysis: ["commerce.reputation.analyze"],
  /** Find sources from a competitor. */
  findSources: ["trusted_sources.competitor_recommender"],
  /** LinkedIn: rewrite the hook of a draft. */
  linkedinRewrite: ["content_editor"],
  /** LinkedIn: turn a newsletter into a carousel. */
  linkedinCarousel: ["linkedin_repurpose_newsletter"],
  /** LinkedIn: suggest a reply to a comment. */
  linkedinReply: ["linkedin.suggest_reply"],
  /** The Strategist: generate content ideas. A run reaches the writing agent and the plan skill; the dearest is charged. */
  contentIdeas: ["content_editor", "skill_execution"],
  /** The Strategist: write the brief for an idea. */
  contentBrief: ["content_editor"],
  /** The Strategist: write the content for an idea. */
  contentDraft: ["content_editor"],
  /** Repurpose a piece for other channels. Which writers run depends on the channels chosen; the dearest is charged. */
  repurpose: ["skill_execution", "write_blog_article", "content_editor", "linkedin_repurpose_newsletter"],
  /** WhatsApp template studio: Draft with AI, Check policy and Suggest a fix each make one call on this row. */
  waTemplateStudio: ["whatsapp.template_studio"],
  /** X: suggest a reply to a mention. */
  xReply: ["skill_execution"],
  /** The composer's AI rewrite (tone, length, angle). */
  composerRewrite: ["content_editor"],
} as const satisfies Record<string, readonly string[]>;

export type ActionCostKey = keyof typeof ACTION_USE_CASES;

export type ActionCost =
  | { state: "loading" }
  | { state: "unknown" }
  | { state: "free" }
  | { state: "priced"; peaks: number; upTo: boolean };

/**
 * The price of an action off the rate card.
 *
 * `rows` is undefined while the card loads; `failed` says it did not arrive.
 * A row the card does not carry makes the whole action `unknown`: pricing the
 * rows we can see and ignoring one we cannot is a quote that may be too low.
 */
export function actionCost(
  rows: readonly Pick<RateCardUseCase, "useCase" | "free" | "creditMultiplier">[] | undefined,
  key: ActionCostKey,
  failed = false,
): ActionCost {
  return priceUseCases(rows, ACTION_USE_CASES[key], failed);
}

/** The rule itself, for any list of rate-card rows (exported so the several-rows case is tested directly). */
export function priceUseCases(
  rows: readonly Pick<RateCardUseCase, "useCase" | "free" | "creditMultiplier">[] | undefined,
  useCases: readonly string[],
  failed = false,
): ActionCost {
  if (!rows) return failed ? { state: "unknown" } : { state: "loading" };
  const found: Array<Pick<RateCardUseCase, "useCase" | "free" | "creditMultiplier">> = [];
  for (const useCase of useCases) {
    const row = rows.find((r) => r.useCase === useCase);
    if (!row) return { state: "unknown" };
    found.push(row);
  }
  // Free is the flag OR no positive price: an api build that predates the flag sends a zero, and "Costs 0" is not a price.
  const isFree = (r: Pick<RateCardUseCase, "free" | "creditMultiplier">): boolean => r.free || !(r.creditMultiplier > 0);
  const priced = found.filter((r) => !isFree(r)).map((r) => r.creditMultiplier);
  if (priced.length === 0) return { state: "free" };
  const peaks = Math.max(...priced);
  // "up to" when the rows differ, and when one of them is free: a run that reaches only the free one costs nothing.
  return { state: "priced", peaks, upTo: new Set(priced).size > 1 || found.some(isFree) };
}

/**
 * The sentence shown beside a button. `unit` is for an action priced per item
 * ("for each page"); it only changes a price, never "Free" or an unknown.
 */
export function actionCostSentence(cost: ActionCost, unit?: string): string {
  switch (cost.state) {
    case "loading":
      return "Checking the price…";
    case "unknown":
      return "The price is on your Peaks page.";
    case "free":
      return "Free — you are never charged for this.";
    case "priced":
      return `Costs ${cost.upTo ? "up to " : ""}${formatPeaks(cost.peaks)} Peaks${unit ? ` ${unit}` : ""}.`;
  }
}

/** The short form for inside a button or a tooltip: "8 Peaks", "Free", or nothing yet. */
export function actionCostShort(cost: ActionCost): string {
  switch (cost.state) {
    case "free":
      return "Free";
    case "priced":
      return `${cost.upTo ? "up to " : ""}${formatPeaks(cost.peaks)} Peaks`;
    default:
      return "";
  }
}
