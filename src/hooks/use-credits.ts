"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

// ── Response types ─────────────────────────────────────────────────────────

export type MeteredBalance = {
  unlimited: false;
  plan: string;
  metric: string;
  hardCap: number;
  softCap: number;
  /** Peaks consumed this window: the charging ledger PLUS consumption the
   *  rollup has not charged yet. Deliberately LEADS the gate by that tail —
   *  which is why it must never be the basis for saying AI is paused. */
  used: number;
  /** `used` without that tail — the ledger alone, which is what the gate
   *  enforces on. Shown nowhere; kept so the two figures can be compared. */
  chargedUsed: number;
  /** ⚠️★THE API'S OWN ANSWER to "would the next AI call be refused?" — the
   *  fair-use gate's predicate, on the gate's input, computed server-side.
   *  Read this to render a pause; never re-derive it from the numbers. */
  blocked: boolean;
  remaining: number;
  windowStartAt: string;
  resetAt: string;
  boostAddonKey: string | null;
  /** Depleting Peaks bought as a top-up pack. Durable — NOT part of the
   *  rolling window, and consumed only once the window allowance is spent. */
  topUpBalance: number;
  /** Whether that balance is actually spendable: true when any tier the org
   *  holds costs money. Free tiers may HOLD top-up Peaks and not spend them,
   *  so the flag is not `topUpBalance > 0`. */
  topUpUsable: boolean;
};

export type CreditsBalance = { unlimited: true; plan: string } | MeteredBalance;

export interface RateCardUseCase {
  useCase: string;
  label: string;
  creditMultiplier: number;
  minCreditsPerCall: number;
}

export interface CreditsHistoryDay {
  date: string;
  peaks: number;
}

// ── Cap status helper ──────────────────────────────────────────────────────

/**
 * Every Peak the org may still spend before the api refuses a call: the plan's
 * window allowance PLUS any purchased top-up it is allowed to draw on.
 *
 * The DENOMINATOR for what this client displays — the percentage, the "X of Y"
 * tooltip, the soft nudge. 🚫Reading `hardCap` alone is what produced "you've
 * used 102% of your monthly Peaks" and "7,000 of 5,000 Peaks remaining" for a
 * customer holding a top-up pack.
 *
 * ⚠️★IT IS NOT WHAT DECIDES A PAUSE — `balance.blocked` is. See `getCapStatus`.
 */
export function spendableCap(balance: MeteredBalance): number {
  return balance.hardCap + (balance.topUpUsable ? balance.topUpBalance : 0);
}

/**
 * Returns "hard" | "soft" | "none". Unlimited plans always return "none".
 *
 * ⚠️★★"hard" IS THE SERVER'S `blocked`, NOT A COMPARISON MADE HERE. This used
 * to be `used >= hardCap`, which was wrong twice over: it had no top-up term,
 * and `used` deliberately leads the gate by the un-charged tail. Together those
 * told a Peakhour Suite customer "Monthly Peaks limit reached. AI features are
 * paused until Sep 12. Upgrade to resume immediately." the day after they bought
 * a 2,000-Peak pack — while `remaining` on that same response read 1,900 and the
 * api refused nothing. 🚫Whether a customer can work is the api's answer to
 * give; this client's job is to render it, not to recompute it.
 *
 * "soft" stays local and stays on the LEADING `used`, which is right for a
 * nudge: it is a statement about the customer's own spend, not a claim about
 * what the api will do.
 */
export function getCapStatus(balance: CreditsBalance | undefined): "hard" | "soft" | "none" {
  if (!balance || balance.unlimited) return "none";
  if (balance.blocked) return "hard";
  // The plan's own warning band (hardCap − softCap), carried up to sit just
  // below the REAL wall. Warning at the bare `softCap` would tell a merchant
  // holding thousands of purchased Peaks that "AI will pause when the limit is
  // reached" while none of them had been touched.
  const cap = spendableCap(balance);
  if (balance.used >= cap - (balance.hardCap - balance.softCap)) return "soft";
  return "none";
}

/**
 * Where a capped org should be sent to get moving again.
 *
 * ⚠️🚫★"Upgrade" is a DEAD END on a paid plan. Peakhour Suite is the top
 * self-serve tier and the api's escalation for it is `boost_or_wait` — the
 * action that actually resumes AI is buying Peaks, not changing plan. Only a
 * free tier has an upgrade to make, and `topUpUsable` is precisely the api's
 * own "this org is on something that costs money" answer, so the CTA and the
 * gate that honours the purchase cannot drift apart.
 */
export function capRecoveryCta(balance: MeteredBalance): { href: string; label: string; verb: string } {
  return balance.topUpUsable
    ? { href: "/dashboard/peaks", label: "Buy Peaks", verb: "Buy Peaks" }
    : { href: "/dashboard/settings/billing", label: "Upgrade plan", verb: "Upgrade" };
}

// ── Cache keys ─────────────────────────────────────────────────────────────

const CREDITS_KEY = "/v1/dashboard/credits";
const RATE_CARD_KEY = "/v1/dashboard/credits/rate-card";
const HISTORY_KEY = "/v1/dashboard/credits/history";

// ── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Fetches the org's Peaks balance summary from /v1/dashboard/credits.
 * Powers the BalanceChip, the cap banners, and the Peaks page header.
 * Refetches every 60s since the rollup cron runs every minute.
 */
export function useCreditsBalance() {
  const { isAuthenticated, org } = useAuth();
  return useQuery<CreditsBalance>({
    queryKey: [CREDITS_KEY, org?._id ?? null],
    queryFn: () => api.get<CreditsBalance>("/v1/dashboard/credits"),
    enabled: isAuthenticated && !!org?._id,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

/**
 * Fetches the rate card (cfg_ai_models useCases with Peaks per call).
 * Stale for 5 minutes — this data changes only when ops updates pricing.
 */
export function useCreditsRateCard() {
  const { isAuthenticated } = useAuth();
  return useQuery<{ useCases: RateCardUseCase[] }>({
    // Rate card is a global catalog (no org-scoped data) — single shared cache entry
    queryKey: [RATE_CARD_KEY],
    queryFn: () => api.get<{ useCases: RateCardUseCase[] }>("/v1/dashboard/credits/rate-card"),
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });
}

/**
 * Fetches 30-day daily Peaks consumption from ts_usage_meters.
 * Powers the usage history drawer on the Peaks page.
 */
export function useCreditsHistory() {
  const { isAuthenticated, org } = useAuth();
  return useQuery<{ days: CreditsHistoryDay[]; total: number }>({
    queryKey: [HISTORY_KEY, org?._id ?? null],
    queryFn: () => api.get<{ days: CreditsHistoryDay[]; total: number }>("/v1/dashboard/credits/history"),
    enabled: isAuthenticated && !!org?._id,
    staleTime: 5 * 60_000,
  });
}
