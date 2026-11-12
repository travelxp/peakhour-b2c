"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { useEditCapabilities } from "@/hooks/use-presence-edit";
import {
  networkCardState,
  nameCheck,
  nameAskAnchor,
  chooseAnotherAction,
  selectedListingFacts,
  type ListingFacts,
  type NetworkConnectionStatus,
} from "@/components/presence/network-card-state";
import type { ConnectableNetwork } from "@/lib/presence-panels";

/**
 * "Is this your business?", read and answered. Shared by the connect card (its line) and the question at the top of the Presence page, so the
 * two judge the same rows and an answer on one is an answer on both.
 *
 * ★NO REQUEST OF ITS OWN: the keys below are the ones the connect card reads (status, capabilities and the picker's list), so this reads the
 * cache the card fills. The picker's list query is never run from here (`enabled: false`); it is observed so a save or an answer the card
 * writes into it reaches the page at once.
 */

export interface ConnectionStatus {
  provider: string;
  status?: NetworkConnectionStatus;
  account?: { name?: string };
  lastError?: string;
}

export interface StoredListing extends ListingFacts {
  locationName: string;
}

export interface CapabilitiesResponse {
  provider: string;
  /** ★NOT where a Google selection lives — see the api route's note. */
  capabilities: Record<string, unknown> | null;
  /** Absent entirely on an api that predates the field. See `networkCardState`. */
  locationNames?: string[];
  account?: {
    extra?: {
      locations?: Array<ListingFacts>;
      locationsComplete?: boolean;
    };
  };
}

export interface LocationsResponse {
  provider: string;
  locations: StoredListing[];
  complete: boolean;
  selected: string[];
  /** Listings dropped from the selection because Google no longer lists them. */
  retired?: string[];
}

export const networkKeys = (provider: string) => ({
  status: ["integration-status", provider] as const,
  cap: ["integration-cap", provider] as const,
  locations: ["network-locations", provider] as const,
});

/** What the question at the top of the page needs: whether to show it, and what it says. */
export function useNameAsk(network: ConnectableNetwork | undefined) {
  const provider = network?.network ?? "";
  const pickerPath = network?.picker?.path ?? null;
  const keys = networkKeys(provider);
  const { business } = useAuth();
  const editCaps = useEditCapabilities();

  const statusQ = useQuery({
    queryKey: keys.status,
    queryFn: () => api.get<ConnectionStatus>(`/v1/integrations/${provider}/status`),
    enabled: !!network,
    refetchOnWindowFocus: false,
  });
  const isConnected = statusQ.data?.status === "active" || statusQ.data?.status === "error";
  const capQ = useQuery({
    queryKey: keys.cap,
    queryFn: () => api.get<CapabilitiesResponse>(`/v1/integrations/${provider}/capabilities`),
    enabled: !!network && isConnected && pickerPath !== null,
    refetchOnWindowFocus: false,
  });
  const locationsQ = useQuery({
    queryKey: keys.locations,
    queryFn: () => api.get<LocationsResponse>(`/v1/integrations/${provider}/${pickerPath}`),
    enabled: false,
  });

  // The picker's answer is fresher than the capabilities read, so it wins once it exists (as on the card).
  const selected = locationsQ.data ? locationsQ.data.selected : capQ.data?.locationNames;
  const card = networkCardState(statusQ.data?.status, selected, pickerPath !== null);
  const known: StoredListing[] = (locationsQ.data?.locations ?? (capQ.data?.account?.extra?.locations as StoredListing[] | undefined) ?? []);
  const confirmable = !!network && pickerPath !== null && network.capabilities.listing !== false;
  const facts = selectedListingFacts(selected, known, confirmable);
  const state = nameCheck(selected?.length ?? 0, facts, business?.name);
  // ★ONLY AN ADMIN OR OWNER SEES IT: the api takes the answer only from them, so to anyone else it is a question they cannot act on.
  // The card keeps its own line for them.
  const canAnswer = editCaps.data?.can.approve === true;
  const another = chooseAnotherAction(known.length, locationsQ.data ? locationsQ.data.complete : capQ.data?.account?.extra?.locationsComplete);
  const show = !!network && card.kind === "ready" && confirmable && state.kind === "ask" && !state.dismissed && canAnswer;
  return {
    show,
    network,
    titles: state.titles,
    pending: state.pending,
    businessName: business?.name ?? "",
    another,
    anchor: nameAskAnchor(provider),
  };
}

/**
 * The answers: "Yes, this is my business" and "Not now", one request per listing that asked. ★ONE AT A TIME INTO THE CACHE: a later one
 * failing must not hide the ones the api has already stored. Both go through the api's confirm route; `not_now` records the title the person saw.
 */
export function useNameAnswer(network: ConnectableNetwork | undefined) {
  const qc = useQueryClient();
  const provider = network?.network ?? "";
  const pickerPath = network?.picker?.path ?? null;
  const keys = networkKeys(provider);
  return useMutation({
    mutationFn: async ({ locationNames, answer }: { locationNames: string[]; answer: "yes" | "not_now" }) => {
      for (const locationName of locationNames) {
        await api.post(`/v1/integrations/${provider}/${pickerPath}/confirm`, { locationName, answer });
        const at = new Date().toISOString();
        const field = answer === "yes" ? "confirmedAt" : "nameAskDismissedAt";
        qc.setQueryData<LocationsResponse>(keys.locations, (old) =>
          old ? { ...old, locations: old.locations.map((l) => (l.locationName === locationName ? { ...l, [field]: at } : l)) } : old,
        );
        // The capabilities read too: with the picker never opened there is no list above to write, and the page reads this one.
        qc.setQueryData<CapabilitiesResponse>(keys.cap, (old) =>
          old?.account?.extra?.locations
            ? { ...old, account: { ...old.account, extra: { ...old.account.extra, locations: old.account.extra.locations.map((l) => (l.locationName === locationName ? { ...l, [field]: at } : l)) } } }
            : old,
        );
      }
    },
    // Returned, so the buttons stay disabled until the read that confirms the answer is back (no second post from a double click).
    onSettled: () => qc.invalidateQueries({ queryKey: keys.cap }),
    onError: (e: Error) => toast.error(e.message || "Could not save that. Try again."),
  });
}
