import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

/**
 * Peakhour Insights Network consent for the active business (PL-6). The routes are the api's existing ones
 * (`/v1/pin/status`, `/v1/pin/consent`, `/v1/pin/consent/withdraw`), the same ledger the Shopify app's Benchmarks page
 * writes: no `version` is sent, so the server records its own default, the one the Shopify page records too.
 */

export interface PinStatus {
  pin: { consentStatus?: { pin_contribution?: "opted_in" | "opted_out" | "pending" | "revoked" } } | null;
}

export const pinApi = {
  status: () => api.get<PinStatus>("/v1/pin/status"),
  optIn: (source: string) => api.post<{ status: string }>("/v1/pin/consent", { consentType: "pin_contribution", source }),
  withdraw: (source: string) => api.post<{ status: string }>("/v1/pin/consent/withdraw", { consentType: "pin_contribution", source }),
};

const key = (businessId: string | undefined) => ["pin", "status", businessId ?? "none"] as const;

/** Whether this business shares its results. Business-scoped: a switched business never sees the last one's answer. */
export function usePinStatus() {
  const { business } = useAuth();
  return useQuery<PinStatus>({ queryKey: key(business?._id), queryFn: () => pinApi.status(), enabled: !!business, retry: false });
}

/** Record the merchant's answer; the status is re-read, so the box shows what the ledger now says. */
export function usePinConsent(source: string) {
  const qc = useQueryClient();
  const { business } = useAuth();
  return useMutation({
    mutationFn: (share: boolean) => (share ? pinApi.optIn(source) : pinApi.withdraw(source)),
    onSettled: () => qc.invalidateQueries({ queryKey: key(business?._id) }),
  });
}

/** Pure: the pin status as a ticked box. Anything but an opt-in is unticked. */
export const isSharing = (s: PinStatus | undefined): boolean => s?.pin?.consentStatus?.pin_contribution === "opted_in";
