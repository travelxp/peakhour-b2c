import type {
  GoogleBiddingChoice,
  GoogleBiddingForm,
  GoogleBiddingHistory,
  GoogleBiddingState,
  GoogleBiddingStrategy,
  GoogleChannelType,
} from "@/lib/api/google-ads";
import { formatGoogleMoney } from "@/lib/google-ads-view";

/**
 * ★★G-14b — what the Google panel's bidding control SAYS and DECIDES (RMF
 * C.96–C.98, M.96–M.98), kept pure so every sentence and rule is tested
 * (`google-bidding-view.test.ts`). The control is used at create
 * (`google-ads-panel.tsx`) and on each campaign (`google-bidding-dialog.tsx`).
 *
 * Maximize Conversions (Standard), Target CPA and Target ROAS (each Standard
 * or Portfolio). Which a campaign type takes mirrors the api's own rule
 * (peakhour-api `adapters/ads/bidding.ts` `googleMerchantBiddingRefusal`,
 * which quotes Google): Performance Max takes no Portfolio strategy, and a
 * YouTube video (Demand Gen) campaign takes Maximize Conversions and a
 * Standard Target CPA only. The api refuses the same choices, by the same
 * words, if one gets past this.
 *
 * ★THE MERCHANT'S TARGET IS KEPT: fewer than 15 conversions in 30 days is a
 * warning shown beside the target, never a reason the target is not sent.
 */

export type GoogleBiddingPick = "DEFAULT" | GoogleBiddingStrategy;

export const GOOGLE_BIDDING_STRATEGIES: ReadonlyArray<{ value: GoogleBiddingStrategy; label: string; hint: string }> = [
  { value: "MAXIMIZE_CONVERSIONS", label: "Maximize Conversions", hint: "Google bids to get as many conversions as it can for the budget." },
  { value: "TARGET_CPA", label: "Target CPA", hint: "Google bids to get conversions at around the cost per conversion you set." },
  { value: "TARGET_ROAS", label: "Target ROAS", hint: "Google bids to get conversion value at around the return on ad spend you set." },
];

export const GOOGLE_BIDDING_FORMS: ReadonlyArray<{ value: GoogleBiddingForm; label: string; hint: string }> = [
  { value: "standard", label: "Standard", hint: "This campaign's own strategy." },
  { value: "portfolio", label: "Portfolio", hint: "A strategy kept in your Google Ads account's shared library, which other campaigns can join." },
];

/** What a create sends with no choice: Search keeps Google's Maximize Clicks; the other two bid on conversions. */
export function googleDefaultBiddingLabel(type: GoogleChannelType | undefined): string {
  return type === "PERFORMANCE_MAX" || type === "DEMAND_GEN" ? "Maximize Conversions" : "Maximize Clicks";
}

export function googleBiddingStrategyLabel(s: string): string {
  if (s === "MAXIMIZE_CLICKS") return "Maximize Clicks";
  if (s === "MAXIMIZE_CONVERSION_VALUE") return "Maximize Conversion Value";
  return GOOGLE_BIDDING_STRATEGIES.find((x) => x.value === s)?.label ?? s.toLowerCase().replace(/_/g, " ");
}

/** Why a campaign type cannot bid with this strategy and form, or null. The api's rule, in its words. */
export function googleBiddingUnavailable(type: GoogleChannelType | undefined, strategy: GoogleBiddingStrategy, form: GoogleBiddingForm): string | null {
  if (strategy === "MAXIMIZE_CONVERSIONS" && form === "portfolio") {
    return "Maximize Conversions is set as the campaign's own (Standard) strategy. For a Portfolio strategy, choose Target CPA or Target ROAS.";
  }
  if (type === "PERFORMANCE_MAX" && form === "portfolio") {
    return "Google doesn't support Portfolio bidding strategies on Performance Max campaigns. Choose the Standard form.";
  }
  if (type === "DEMAND_GEN") {
    if (strategy === "TARGET_ROAS") return "Target ROAS isn't available here for YouTube video (Demand Gen) campaigns. Choose Maximize Conversions or Target CPA.";
    if (form === "portfolio") return "Portfolio bidding strategies aren't available here for YouTube video (Demand Gen) campaigns. Choose the Standard form.";
  }
  return null;
}

/** Whether the type offers the Portfolio form for any strategy (the form control is hidden when not). */
export function googlePortfolioOffered(type: GoogleChannelType | undefined): boolean {
  return type !== "PERFORMANCE_MAX" && type !== "DEMAND_GEN";
}

/** The strategies a type offers. */
export function googleBiddingStrategiesFor(type: GoogleChannelType | undefined) {
  return GOOGLE_BIDDING_STRATEGIES.filter((s) => googleBiddingUnavailable(type, s.value, "standard") === null);
}

// ── the draft the control edits ──────────────────────────────────────────

/** `target` as typed: an amount for a Target CPA, a PERCENT for a Target ROAS (350 is 350%, Google Ads' own unit). */
export interface GoogleBiddingDraft {
  pick: GoogleBiddingPick;
  form: GoogleBiddingForm;
  target: string;
}
export const EMPTY_BIDDING_DRAFT: GoogleBiddingDraft = { pick: "DEFAULT", form: "standard", target: "" };

/** Google's target ROAS bounds, "between 0.01 and 1000.0, inclusive", as the percent the merchant types. */
export const GOOGLE_ROAS_PERCENT = { min: 1, max: 100_000 } as const;

/** A typed number, or NaN. ".5", "5." and a decimal comma ("12,5") are numbers (review round 1); "1e3" is not. */
function typed(raw: string): number {
  const t = raw.trim().replace(",", ".");
  return /^([0-9]+\.?[0-9]*|\.[0-9]+)$/.test(t) ? Number(t) : NaN;
}

/**
 * The draft after the strategy is changed. ★THE TARGET IS CLEARED WHEN ITS UNIT CHANGES (review round 1): a Target CPA
 * of 5 is not a 5% ROAS, and a kept number would be sent under the other meaning.
 */
export function googleBiddingWithPick(d: GoogleBiddingDraft, pick: GoogleBiddingPick): GoogleBiddingDraft {
  return pick === d.pick ? d : { ...d, pick, target: "" };
}

/** Why this draft cannot be sent, or null. DEFAULT is allowed only where `allowDefault` (the create form). */
export function googleBiddingProblem(type: GoogleChannelType | undefined, d: GoogleBiddingDraft, allowDefault: boolean): string | null {
  if (d.pick === "DEFAULT") return allowDefault ? null : "Choose a bidding strategy.";
  const form = d.pick === "MAXIMIZE_CONVERSIONS" ? "standard" : d.form;
  const unavailable = googleBiddingUnavailable(type, d.pick, form);
  if (unavailable) return unavailable;
  if (d.pick === "MAXIMIZE_CONVERSIONS") return null;
  const n = typed(d.target);
  if (d.pick === "TARGET_CPA") return Number.isFinite(n) && n > 0 ? null : "Enter the cost per conversion you want, greater than 0.";
  if (!Number.isFinite(n) || n < GOOGLE_ROAS_PERCENT.min || n > GOOGLE_ROAS_PERCENT.max) {
    return `Enter a target ROAS from ${GOOGLE_ROAS_PERCENT.min}% to ${GOOGLE_ROAS_PERCENT.max.toLocaleString("en")}%.`;
  }
  return null;
}

/** The choice the api takes, or undefined for DEFAULT (the create sends no `bidding`). Call after `googleBiddingProblem` is null. */
export function googleBiddingChoiceOf(d: GoogleBiddingDraft): GoogleBiddingChoice | undefined {
  if (d.pick === "DEFAULT") return undefined;
  if (d.pick === "MAXIMIZE_CONVERSIONS") return { strategy: "MAXIMIZE_CONVERSIONS", form: "standard" };
  const n = typed(d.target);
  // ROAS: the typed percent as Google's ratio, exactly (review round 1: 350.5% is 3.505, as checked), to 6 places
  //  so a float's tail is not sent.
  return { strategy: d.pick, form: d.form, target: d.pick === "TARGET_ROAS" ? Number((n / 100).toFixed(6)) : n };
}

const isStrategy = (s: string): s is GoogleBiddingStrategy => GOOGLE_BIDDING_STRATEGIES.some((x) => x.value === s);

/**
 * The draft a campaign's current bidding opens as: its own strategy when it is one of the three, even with no target
 * to show (review round 1: a Target CPA with no readable target opens as Target CPA, not as a switch); Maximize
 * Conversions for anything else, which `googleBiddingSavable` then lets the merchant save as it stands.
 */
export function googleBiddingDraftOf(state: GoogleBiddingState | undefined): GoogleBiddingDraft {
  if (!state || !isStrategy(state.strategy)) return { ...EMPTY_BIDDING_DRAFT, pick: "MAXIMIZE_CONVERSIONS" };
  const strategy = state.strategy;
  const target = state.target === undefined ? "" : strategy === "TARGET_ROAS" ? String(Math.round(state.target * 100)) : String(state.target);
  return { pick: strategy, form: state.form, target };
}

/**
 * Whether the dialog's Save is offered: after an edit, or (review round 1) when what Google holds is not what the
 * control shows, so the strategy it opened on can be saved without picking something else first.
 */
export function googleBiddingSavable(state: GoogleBiddingState | undefined, edited: boolean): boolean {
  return edited || (!!state && (!state.managed || !isStrategy(state.strategy)));
}

// ── what is said ─────────────────────────────────────────────────────────

/**
 * ★THE "FEWER THAN 15 CONVERSIONS" WARNING, never a refusal: shown when a
 * target strategy is picked and the account's last 30 days had fewer than
 * Google advises, or could not be read. Null otherwise.
 */
export function googleBiddingWarning(pick: GoogleBiddingPick, history: GoogleBiddingHistory | undefined): string | null {
  if (!history || (pick !== "TARGET_CPA" && pick !== "TARGET_ROAS")) return null;
  const kept = "Your target is still used as you set it.";
  if (history.conversions30d === null) {
    return `We couldn't read this account's conversions for the last ${history.days} days, so we can't say whether Google has enough to bid to a target. ${kept}`;
  }
  if (history.conversions30d >= history.minimum) return null;
  const n = Math.round(history.conversions30d * 100) / 100;
  return (
    `This account had ${n} ${n === 1 ? "conversion" : "conversions"} in the last ${history.days} days. Target bidding works best with at least ` +
    `${history.minimum}, so Google may bid unevenly until it has more. ${kept}`
  );
}

/** A campaign's current bidding, in one line. */
export function googleBiddingSentence(state: GoogleBiddingState, currency: string | undefined): string {
  const name = googleBiddingStrategyLabel(state.strategy);
  const target =
    state.target === undefined
      ? ""
      : state.strategy === "TARGET_ROAS"
        ? ` of ${Math.round(state.target * 100)}%`
        : state.strategy === "TARGET_CPA"
          ? ` of ${formatGoogleMoney(state.target, currency)}`
          : "";
  if (state.form === "portfolio") {
    const p = state.portfolio;
    const shared = p?.campaigns !== undefined && p.campaigns > 1 ? `, shared with ${p.campaigns - 1} other ${p.campaigns === 2 ? "campaign" : "campaigns"}` : "";
    return `${name}${target}, a Portfolio strategy${p?.name ? ` ("${p.name}")` : ""}${shared}.`;
  }
  return `${name}${target}.${state.managed ? "" : " Peakhour can switch it to one of the strategies below."}`;
}

/** After a save: what Google now has. */
export function googleBiddingSavedSentence(choice: GoogleBiddingChoice, changed: boolean): string {
  if (!changed) return "The bidding was already set that way, so nothing changed.";
  return `Bidding set to ${googleBiddingStrategyLabel(choice.strategy)}${choice.form === "portfolio" ? " (Portfolio)" : ""}. Google may take a few days to learn a new strategy.`;
}
