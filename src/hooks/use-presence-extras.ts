"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { presenceChangesApi } from "@/lib/api/presence-changes";
import { presenceEditApi } from "@/lib/api/presence-edit";
import { presenceExtrasApi, type ExtraProposal } from "@/lib/api/presence-extras";
import { presenceEditKeys, type ChangeCardData } from "@/lib/presence-edit";
import { inFlightChanges, liveDraft, nextDraft, settledSince, type BasedDraft, type AttributesResponse, type ExtraField, type LinksResponse, type PostsResponse, type ServicesResponse } from "@/lib/presence-extras";

interface Answers {
  posts: PostsResponse;
  services: ServicesResponse;
  attributes: AttributesResponse;
  links: LinksResponse;
}

export const presenceExtrasKey = (field: ExtraField, listingId: string, network: string) => ["presence", "extras", field, listingId, network] as const;

/**
 * What the network holds for one panel. Not refetched on focus: it is a call to the network, and a change refreshes it when one settles.
 * `retry: false` so a network that cannot answer is said at once and offered "Try again" rather than hidden behind retries.
 */
export function useExtra<F extends ExtraField>(field: F, listingId: string | undefined, network: string | undefined, enabled = true) {
  return useQuery<Answers[F]>({
    queryKey: presenceExtrasKey(field, listingId ?? "", network ?? ""),
    queryFn: () => presenceExtrasApi[field](listingId as string, network as string) as Promise<Answers[F]>,
    enabled: enabled && !!listingId && !!network,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/** Where a mutation belongs, carried IN the variables: a response that arrives after the screen moved to another place is still about the one it was sent for. */
export interface ExtraTarget {
  listingId: string;
  network: string;
}

/**
 * Proposals, approve, decline and undo for one panel. `propose` carries its place in its variables and refreshes nothing by itself; the caller
 * calls `refresh(target)` once after it. Approve, decline and undo take the change's id (the change card's own call) and refresh in `onSettled`.
 */
export function useExtraMutations(field: ExtraField, target: ExtraTarget | null) {
  const qc = useQueryClient();
  const refresh = async (t: ExtraTarget) => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: presenceExtrasKey(field, t.listingId, t.network) }),
      qc.invalidateQueries({ queryKey: presenceEditKeys.changes(t.listingId) }),
      // a live links change rewrites the booking and order addresses on the listing
      qc.invalidateQueries({ queryKey: ["presence", "listing"] }),
    ]);
  };
  /** After a proposal only the change list is read again (not awaited): the list the panel shows did not change. */
  const refreshChanges = (t: ExtraTarget) => qc.invalidateQueries({ queryKey: presenceEditKeys.changes(t.listingId) });
  const settled = async () => {
    if (target) await refresh(target);
  };
  return {
    refresh,
    refreshChanges,
    propose: useMutation({ mutationFn: (v: ExtraTarget & { proposal: ExtraProposal }) => presenceExtrasApi.propose(v.listingId, v.network, v.proposal) }),
    approve: useMutation({ mutationFn: (id: string) => presenceChangesApi.approve(id), onSettled: settled }),
    reject: useMutation({ mutationFn: (id: string) => presenceChangesApi.reject(id), onSettled: settled }),
    undo: useMutation({ mutationFn: (id: string) => presenceEditApi.undo(id), onSettled: settled }),
  };
}

/** Reads the panel again when a change of its field leaves the in-flight statuses (went live, failed, declined, expired). */
export function useRefreshWhenSettled(field: ExtraField, items: ChangeCardData[] | undefined, target: ExtraTarget | null) {
  const qc = useQueryClient();
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!items || !target) return;
    if (settledSince(seen.current, items, target.network, field)) {
      void qc.invalidateQueries({ queryKey: presenceExtrasKey(field, target.listingId, target.network) });
      // a links change that went live rewrote the booking and order addresses on the listing
      if (field === "links") void qc.invalidateQueries({ queryKey: ["presence", "listing"] });
    }
    seen.current = new Set(inFlightChanges(items, target.network, field).map((c) => c.id));
  }, [items, target?.listingId, target?.network, field, qc]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * The draft of a whole list, with the `base` of the list it STARTED from (captured by its first edit, never changed under it). When the list the
 * panel reads has a different base the draft is dropped, never silently re-based onto a list the person did not see; `dropped` says so, for the words.
 */
export function useBasedDraft<T>(baseNow: string) {
  const [state, setState] = useState<BasedDraft<T> | null>(null);
  const [dropped, setDropped] = useState(false);
  const live = liveDraft(state, baseNow);
  if (state && live.dropped) {
    // adjusting state while rendering (React's way to reset on a changed input)
    setState(null);
    setDropped(true);
  }
  return {
    draft: live.draft?.value ?? null,
    base: live.draft?.base ?? null,
    dropped,
    set: (value: T) => {
      setDropped(false);
      setState((prev) => nextDraft(prev, value, baseNow));
    },
    clear: () => {
      setDropped(false);
      setState(null);
    },
  };
}
