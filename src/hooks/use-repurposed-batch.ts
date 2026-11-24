"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { needsOkKeys } from "@/hooks/use-needs-ok";
import { homeSummaryKey } from "@/hooks/use-home-summary";

/**
 * One repurposed batch on screen: GET /v1/content/repurposed/:id, and the two decisions.
 *
 * The decisions are the api's WhatsApp-YES path made from a screen (same claim, same start of publishing), so a batch
 * decided in either place reads as decided in the other. They are free: no AI call, no Peaks.
 */

export interface RepurposedVariant {
  platform: string;
  text: string;
  hook: string | null;
  hashtags: string[];
  /** The comment the writer suggests Peakhour adds under this post once it is live, already cut to the channel's limit; null when none (or the channel takes none). */
  firstComment: string | null;
}

/** What approving does for one variant: the api's answer, from the same rules the approval applies. */
export interface VariantEffect {
  platform: string;
  channel: string;
  outcome: "will_publish" | "already_done" | "not_connected" | "not_allowed";
  /** "approval_flow" is the LinkedIn job of an auto batch; "calendar" is the scheduler plan. */
  via: "approval_flow" | "calendar" | null;
  /** Why it will not go out (or is already done), in the merchant's words. */
  reason: string | null;
}

export interface RepurposedBatch {
  id: string;
  title: string;
  /** soc_social_posts.status: pending_approval, approved, discarded, expired, published ... */
  status: string;
  createdAt: string | null;
  /** When the approval window closes, or null for a batch without one. */
  expiresAt: string | null;
  /** Where it was decided ("whatsapp" | "dashboard"), or null while it waits. */
  decidedVia: string | null;
  /** Waiting AND inside its window: the same test WhatsApp YES applies. */
  canDecide: boolean;
  /** Per variant, what approving will do. Empty once the batch can no longer be decided. */
  approveEffect: VariantEffect[];
  mediaUrls: string[];
  variants: RepurposedVariant[];
}

export interface RepurposedDecision {
  id: string;
  status: string;
  /** True when it was already in that state (a second press, or WhatsApp first): nothing changed. */
  alreadyDecided: boolean;
  message: string;
  variants: VariantEffect[];
}

export const repurposedKeys = {
  detail: (id: string) => ["repurposed-batch", id] as const,
};

export function useRepurposedBatch(id: string) {
  return useQuery({
    queryKey: repurposedKeys.detail(id),
    queryFn: () => api.get<RepurposedBatch>(`/v1/content/repurposed/${encodeURIComponent(id)}`),
    staleTime: 15_000,
  });
}

/** A decision, with (for an approval) the first comments the person left different from what was suggested: channel -> text, blank to clear. */
export type RepurposedDecisionInput = { decision: "approve"; firstComments?: Record<string, string> } | { decision: "reject" };

export function useDecideRepurposedBatch(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RepurposedDecisionInput) => {
      const { decision } = input;
      const firstComments = input.decision === "approve" ? input.firstComments : undefined;
      const url = `/v1/content/repurposed/${encodeURIComponent(id)}` + (decision === "approve" ? "/approve" : "/reject");
      // No body unless the person changed a first comment: an approval with nothing to say about it is the same request it always was.
      return firstComments && Object.keys(firstComments).length > 0
        ? api.post<RepurposedDecision>(url, { firstComments })
        : api.post<RepurposedDecision>(url);
    },
    // Returned, so the mutation stays pending until the refetches land: the buttons come back as the batch's new state,
    // never as the old one (a press in that gap would be a second, conflicting decision).
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: repurposedKeys.detail(id) }),
        queryClient.invalidateQueries({ queryKey: needsOkKeys.all }),
        queryClient.invalidateQueries({ queryKey: homeSummaryKey }),
      ]),
  });
}
