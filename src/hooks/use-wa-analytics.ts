"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

/**
 * What the WhatsApp assistant reached over a window: counts, for information. There is no price here on purpose: AI credits are
 * for a task Peakhour does (each reply), never for a result (peakhour-api C8, 2026-11-04).
 */
export interface WaAnalytics {
  windowDays: number;
  resolved: { count: number };
  assisted: { count: number };
}

/** WhatsApp results for the active business: conversations resolved and orders the assistant helped with. */
export function useWaAnalytics(days = 30) {
  const { business } = useAuth();
  return useQuery({
    queryKey: ["wa-analytics", business?._id ?? "none", days],
    queryFn: () => api.get<WaAnalytics>(`/v1/meta/whatsapp/analytics?days=${days}`),
    enabled: Boolean(business?._id),
  });
}
