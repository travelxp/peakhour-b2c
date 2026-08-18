"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

export interface WaAnalytics {
  windowDays: number;
  resolved: { count: number; peaks: number };
  assisted: { count: number; peaks: number };
  totalPeaks: number;
  byPillar: Array<{ pillar: string; peaks: number }>;
}

/** WhatsApp outcome analytics for the active business (KPIs + by-pillar). */
export function useWaAnalytics(days = 30) {
  const { business } = useAuth();
  return useQuery({
    queryKey: ["wa-analytics", business?._id ?? "none", days],
    queryFn: () => api.get<WaAnalytics>(`/v1/meta/whatsapp/analytics?days=${days}`),
    enabled: Boolean(business?._id),
  });
}
