"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

export type ExplainSurface = "ga4" | "gsc";

export interface ExplainNarration {
  headline: string;
  lines: string[];
  sentiment: "positive" | "neutral" | "concern";
  nextAction?: string;
}

export interface ExplainResponse {
  /** True when there's a week-over-week digest worth narrating. */
  available: boolean;
  reason?: string;
  narration: ExplainNarration | null;
  cached: boolean;
  stale?: boolean;
}

const BASE: Record<ExplainSurface, string> = {
  ga4: "analytics-insights",
  gsc: "search-insights",
};
const PARAM: Record<ExplainSurface, string> = { ga4: "propertyId", gsc: "siteUrl" };

function path(surface: ExplainSurface, resource: string | undefined, refresh: boolean): string {
  const params = new URLSearchParams();
  if (resource) params.set(PARAM[surface], resource);
  if (refresh) params.set("refresh", "1");
  const qs = params.toString();
  return `/v1/content/${BASE[surface]}/explain${qs ? `?${qs}` : ""}`;
}

/**
 * The user-triggered Tier-2 "Explain this" narration for a dashboard surface.
 * GET reads the cached narration (never spends); `generate` POSTs to create or
 * refresh it (spends one Peak, gated server-side by fair-use). Query key is
 * scoped by business + surface + property so switching either re-reads.
 */
export function useExplain(surface: ExplainSurface, resource: string | undefined, enabled = true) {
  const { business } = useAuth();
  const qc = useQueryClient();
  const key = ["explain", surface, business?._id ?? "none", resource ?? "default"];

  const query = useQuery({
    queryKey: key,
    queryFn: () => api.get<ExplainResponse>(path(surface, resource, false)),
    enabled: enabled && Boolean(business?._id),
    refetchOnWindowFocus: false,
  });

  const generate = useMutation({
    mutationFn: (opts?: { refresh?: boolean }) =>
      api.post<ExplainResponse>(path(surface, resource, opts?.refresh ?? false), {}),
    // Write the fresh narration straight into the GET cache so the card updates
    // without a second round-trip.
    onSuccess: (data) => qc.setQueryData(key, data),
  });

  return { query, generate };
}
