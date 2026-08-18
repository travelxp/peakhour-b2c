"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

// ── Response types ─────────────────────────────────────────────────────────

export type CreditsBalance =
  | { unlimited: true; plan: string }
  | {
      unlimited: false;
      plan: string;
      metric: string;
      hardCap: number;
      softCap: number;
      used: number;
      remaining: number;
      windowStartAt: string;
      resetAt: string;
      boostAddonKey: string | null;
    };

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

/** Returns "hard" | "soft" | "none". Unlimited plans always return "none". */
export function getCapStatus(balance: CreditsBalance | undefined): "hard" | "soft" | "none" {
  if (!balance || balance.unlimited) return "none";
  if (balance.used >= balance.hardCap) return "hard";
  if (balance.used >= balance.softCap) return "soft";
  return "none";
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
