"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { keepWithinBusiness } from "@/lib/wa-conversation-export";
import { supportResultsPath, type SupportParams, type SupportResults } from "@/lib/support-results";

/**
 * The support results for the active business (Inbox CSAT and support analytics, I3c): one read, the api's
 * `GET /v1/meta/whatsapp/support-analytics`. The key carries the business and every filter, so a business switch or a new range
 * never shows another's numbers; the previous numbers stay on screen only while the SAME business loads a new filter.
 */
export function supportResultsKey(businessId: string | undefined, p: SupportParams) {
  return ["support-results", businessId ?? "none", p.from, p.to, p.channel, p.timeZone] as const;
}

export function useSupportResults(params: SupportParams, enabled = true) {
  const { business } = useAuth();
  const businessId = business?._id;
  return useQuery({
    queryKey: supportResultsKey(businessId, params),
    queryFn: () => api.get<SupportResults>(supportResultsPath(params)),
    enabled: Boolean(businessId) && enabled,
    // ★v5: `isLoading` is false for a PAUSED query (offline); the page reads `isPending`.
    placeholderData: (prev: SupportResults | undefined, prevQuery) => keepWithinBusiness(prev, prevQuery?.queryKey, businessId ?? "none"),
  });
}

/**
 * Switch "ask customers to rate" on or off. The switch is read back with the results (`csatEnabled`), so a save re-reads them and the
 * page shows what the server holds, not what was clicked.
 */
export function useCsatSetting() {
  const { business } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => api.patch<{ enabled: boolean }>("/v1/meta/whatsapp/csat-settings", { enabled }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["support-results", business?._id ?? "none"] });
    },
  });
}
