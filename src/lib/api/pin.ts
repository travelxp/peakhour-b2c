import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

/**
 * Peakhour Insights Network consent for the active business (PL-6). The routes are the api's existing ones
 * (`/v1/pin/status`, `/v1/pin/consent`, `/v1/pin/consent/withdraw`), the same ledger the Shopify app's Benchmarks page
 * writes. ★THE WORDS COME FROM THE API: `/v1/pin/status` serves the consent version First run records and its exact
 * text (the api's one table of consent texts), and the answer is sent under that version, so the ledger always names
 * what the merchant read.
 */

export interface PinStatus {
  pin: { consentStatus?: { pin_contribution?: "opted_in" | "opted_out" | "pending" | "revoked" } } | null;
  /** The consent this screen asks for: its version, its exact words, and whether this user may answer it (admin or owner). */
  consent?: { version: string; text: string; canAnswer: boolean };
}

export const pinApi = {
  status: () => api.get<PinStatus>("/v1/pin/status"),
  optIn: (source: string, version: string) => api.post<{ status: string }>("/v1/pin/consent", { consentType: "pin_contribution", source, version }),
  withdraw: (source: string, version: string) => api.post<{ status: string }>("/v1/pin/consent/withdraw", { consentType: "pin_contribution", source, version }),
};

const key = (businessId: string | undefined) => ["pin", "status", businessId ?? "none"] as const;

/** Whether this business shares its results. Business-scoped: a switched business never sees the last one's answer. */
export function usePinStatus() {
  const { business } = useAuth();
  return useQuery<PinStatus>({ queryKey: key(business?._id), queryFn: () => pinApi.status(), enabled: !!business, retry: false });
}

/** Record the merchant's answer under the version it was shown; the status is re-read, so the box shows what the ledger now says. */
export function usePinConsent(source: string) {
  const qc = useQueryClient();
  const { business } = useAuth();
  return useMutation({
    mutationFn: ({ share, version }: { share: boolean; version: string }) => (share ? pinApi.optIn(source, version) : pinApi.withdraw(source, version)),
    onSettled: () => qc.invalidateQueries({ queryKey: key(business?._id) }),
  });
}

/** Pure: the pin status as a ticked box. Anything but an opt-in is unticked. */
export const isSharing = (s: PinStatus | undefined): boolean => s?.pin?.consentStatus?.pin_contribution === "opted_in";
