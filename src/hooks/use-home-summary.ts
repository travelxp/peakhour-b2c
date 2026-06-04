"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * Data hook for the Autopilot Home (Content > Autopilot).
 *
 * Backed by GET /v1/home/summary — one round trip returns the KPIs, the
 * autopilot status, the priority-ordered Needs-you rail, and per-channel
 * widgets. Polls on a gentle cadence because the underlying data
 * (scheduled items, pipeline runs) is moved by crons; the page also wires
 * a CronToolbar (non-prod) whose onTriggered invalidates this key for an
 * instant refresh after a manual trigger.
 */

export type AutopilotState = "working" | "waiting" | "stalled";
export type ChannelHealth = "healthy" | "attention" | "disconnected";
export type RailItemType = "reconnect" | "failed" | "approve";

export interface RailItem {
  type: RailItemType;
  channel: string;
  refId: string;
  title: string;
  ctaHref: string;
}

export interface ChannelWidget {
  key: string;
  name: string;
  health: ChannelHealth;
  counts: {
    needsApproval: number;
    scheduled: number;
    needsAttention: number;
    ideas: number;
  };
  /** 7-day impressions series, oldest → newest. Empty when no series exists. */
  spark: number[];
  openHref: string;
}

export interface CommerceLane {
  connected: boolean;
  productCount: number | null;
  contentCount: number | null;
  /** Deferred — money-loop attribution lands in a later PR. */
  moneyLoop: {
    revenueAttributed?: number;
    orders?: number;
    topDriver?: string;
    currency?: string;
  } | null;
}

export interface HomeSummary {
  generatedAt: string;
  entitlements: { marketing: boolean; commerce: boolean };
  kpis: {
    publishedThisWeek: number;
    needsYou: number;
    scheduledUpcoming: number;
  };
  autopilot: { state: AutopilotState; reason: string; lastRunAt: string | null };
  needsYou: RailItem[];
  channels: ChannelWidget[];
  commerce: CommerceLane | null;
  moveOfTheWeek: unknown | null;
}

export const homeSummaryKey = ["home", "summary"] as const;

export function useHomeSummary() {
  return useQuery({
    queryKey: homeSummaryKey,
    queryFn: () => api.get<HomeSummary>("/v1/home/summary"),
    // The rail/widgets reflect cron-moved state; 60s keeps it fresh
    // without hammering. Stop on error so a stale auth cookie doesn't
    // spin one failed request per minute on this route.
    refetchInterval: (q) => (q.state.error ? false : 60_000),
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });
}
