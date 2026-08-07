"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import {
  signalsApi,
  type Signal,
  type SignalProvider,
  type SignalRail,
  type SignalsResponse,
  type SnippetResponse,
} from "@/lib/api/signals";

/**
 * Website signals — the tracking tags a business has on its own site.
 *
 * ★THE BUSINESS IS IN EVERY KEY. A signal is per-business (its partner id, its
 * public site key, its verification), and a cache key that did not say which
 * business is one `clear()` away from showing another one's site key — which
 * is the value the customer is about to paste into a page.
 */

const key = (businessId: string | undefined) => ["signals", businessId ?? "none"] as const;

export function useSignals() {
  const { business } = useAuth();
  return useQuery<SignalsResponse>({
    queryKey: key(business?._id),
    queryFn: () => signalsApi.list(),
    // ★NO `refetchInterval`. A signal that has never fired is waiting on a
    // human — installing a snippet, or a visitor arriving — and polling every
    // few seconds would spend the customer's battery to re-render an unchanged
    // "not yet". The page offers an explicit re-check instead, which is also
    // the honest shape: we are not watching, we are looking when asked.
    staleTime: 30_000,
  });
}

/**
 * The snippet, fetched only when a surface actually asks for it.
 *
 * Separate from the list because it is per-provider and because the api
 * REFUSES rather than guessing its own origin — a snippet carrying the wrong
 * beacon address would be pasted somewhere permanent and could never verify.
 * That refusal has to be able to surface on its own.
 */
export function useSignalSnippet(provider: SignalProvider | null) {
  const { business } = useAuth();
  return useQuery<SnippetResponse>({
    queryKey: [...key(business?._id), "snippet", provider],
    queryFn: () => signalsApi.snippet(provider as SignalProvider),
    enabled: !!provider,
  });
}

export function useCreateSignal() {
  const qc = useQueryClient();
  const { business } = useAuth();
  return useMutation<Signal, unknown, { provider: SignalProvider; partnerId: string; rail: SignalRail }>({
    mutationFn: (body) => signalsApi.create(body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key(business?._id) }),
  });
}

export function useUpdateSignal() {
  const qc = useQueryClient();
  const { business } = useAuth();
  return useMutation<
    Signal,
    unknown,
    { provider: SignalProvider; patch: { partnerId?: string; rail?: SignalRail } }
  >({
    mutationFn: ({ provider, patch }) => signalsApi.update(provider, patch),
    // ★THE SNIPPET IS INVALIDATED TOO, and it is the one that matters: changing
    // the partner id changes the snippet the customer has to republish, and a
    // cached copy of the old one is the exact thing they must not paste.
    onSuccess: () => void qc.invalidateQueries({ queryKey: key(business?._id) }),
  });
}

export function useRemoveSignal() {
  const qc = useQueryClient();
  const { business } = useAuth();
  return useMutation({
    mutationFn: (provider: SignalProvider) => signalsApi.remove(provider),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key(business?._id) }),
  });
}
