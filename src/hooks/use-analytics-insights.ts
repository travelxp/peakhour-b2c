"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

// ── Types (mirror peakhour-api GET /v1/content/analytics-insights) ───────────
export interface Ga4Funnel {
  sessions: number;
  totalUsers: number;
  engagedSessions: number;
  engagementRatePct: number;
  conversions: number;
  eventCount: number;
}
export interface Ga4Channel {
  channel: string;
  sessions: number;
  conversions: number;
}
export interface Ga4Page {
  pagePath: string;
  views: number;
  engagementRatePct: number;
  conversions: number;
}
export interface Ga4TrendPoint {
  date: string;
  sessions: number;
  totalUsers: number;
  conversions: number;
  engagedSessions: number;
}
export interface Ga4TrendMetric {
  now: number;
  prev: number;
  deltaPct: number | null;
}
export type Ga4MovementKind = "surging" | "dropping" | "new" | "lost";
export interface Ga4Movement {
  kind: Ga4MovementKind;
  scope: "page" | "channel";
  entity: string;
  now: number;
  prev: number;
  deltaPct: number | null;
  detail: string;
}
export interface Ga4Digest {
  hasComparison: boolean;
  headline: string;
  trend: {
    sessions: Ga4TrendMetric;
    totalUsers: Ga4TrendMetric;
    conversions: Ga4TrendMetric;
    engagementRate: { now: number; prev: number; delta: number | null };
  };
  movements: Ga4Movement[];
}
export interface AnalyticsInsightsResponse {
  connected: boolean;
  configured: boolean;
  pending: boolean;
  isPaid: boolean;
  connectionId?: string;
  property?: string;
  period?: string;
  funnel?: Ga4Funnel;
  // channels/trend/trendWindowDays are sent ONLY on the ready state — optional
  // so a consumer reading them in a pending/not-configured state can't crash.
  channels?: Ga4Channel[];
  trend?: Ga4TrendPoint[];
  trendWindowDays?: number;
  // pages/lockedPages are sent in every state.
  pages: Ga4Page[];
  lockedPages: number;
  digest?: Ga4Digest;
}

/** Query key prefix — exported so CronToolbar onTriggered can invalidate it. */
export const ANALYTICS_INSIGHTS_KEY = "analytics-insights";

/**
 * GA4 dashboard data for the active business — funnel + channels + top pages +
 * day-grain trend + week-over-week digest. Deterministic (no AI). `propertyId`
 * selects a specific GA4 property in a multi-property setup.
 */
export function useAnalyticsInsights(propertyId?: string, enabled = true) {
  const { business } = useAuth();
  return useQuery({
    queryKey: [ANALYTICS_INSIGHTS_KEY, business?._id ?? "none", propertyId ?? "default"],
    queryFn: () =>
      api.get<AnalyticsInsightsResponse>(
        `/v1/content/analytics-insights${propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : ""}`,
      ),
    enabled: enabled && Boolean(business?._id),
    refetchOnWindowFocus: false,
  });
}
