import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { googleAdsApi, type GoogleConversionSignal } from "@/lib/api/google-ads";
import { metaAdsApi } from "@/lib/api/meta-ads";
import type { SignalPlatform, SignalReadiness } from "@/lib/growth-v2-signal";
import { useAuth } from "@/providers/auth-provider";

/**
 * Growth Engine v2 client for First-run's signal step (C3). The readiness rule
 * is the api's (`GET /v1/growth/v2/onboarding/signal`); the two "set up" calls are
 * the platforms' own routes, which validate against a live read.
 */

export const growthV2SignalApi = {
  readiness: () => api.get<SignalReadiness>("/v1/growth/v2/onboarding/signal"),
  acceptUntracked: (platform: SignalPlatform) => api.post<SignalReadiness>("/v1/growth/v2/onboarding/signal/untracked", { platform }),
};

const key = (businessId: string | undefined) => ["growth-v2", "signal", businessId ?? "none"] as const;

export function useSignalReadiness() {
  const { business } = useAuth();
  return useQuery<SignalReadiness>({
    // ★BUSINESS-SCOPED: a session that switches business must not see the last one's signal.
    queryKey: key(business?._id),
    queryFn: () => growthV2SignalApi.readiness(),
    enabled: !!business,
    retry: false,
  });
}

/** The mutations of the step. Each re-reads the readiness, so the button follows the api's rule and nothing local. */
export function useSignalActions() {
  const qc = useQueryClient();
  const { business } = useAuth();
  // The Ads dashboard's cards read the same facts under their own keys: refresh them too, or they offer to create what exists.
  const done = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: key(business?._id) }),
      qc.invalidateQueries({ queryKey: ["google-conversion-action"] }),
      qc.invalidateQueries({ queryKey: ["meta-ads-dataset"] }),
    ]);
  return {
    setUpMeta: useMutation({ mutationFn: (adAccountId: string) => metaAdsApi.createDataset(adAccountId), onSettled: done }),
    setUpGoogle: useMutation({
      mutationFn: (v: { adAccountId: string; signal: GoogleConversionSignal }) => googleAdsApi.setConversionAction(v.adAccountId, { signal: v.signal }),
      onSettled: done,
    }),
    acceptUntracked: useMutation({ mutationFn: (platform: SignalPlatform) => growthV2SignalApi.acceptUntracked(platform), onSettled: done }),
  };
}
