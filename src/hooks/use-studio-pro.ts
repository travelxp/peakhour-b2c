"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { studioApi, type BatchBody, type BatchOp, type BatchQuote, type BatchView, type PressReceipts } from "@/lib/api/creative-studio";
import { FLOW_KEYS } from "@/hooks/use-studio-flow";
import { CREDITS_KEY } from "@/hooks/use-credits";
import { jobsKeys } from "@/hooks/use-jobs";
import { derivePressQuote, type PressQuoteState } from "@/lib/studio-flow";
import { useAuth } from "@/providers/auth-provider";

/** Query keys for the Pro tools screens (S16 to S18), in one place so a mutation can name the ones it changes. */
export const PRO_KEYS = {
  batch: FLOW_KEYS.batch,
  versions: "studio-versions",
  /** The price of a whole batch (S16): asked when the confirm sheet opens. */
  batchQuote: "studio-batch-quote",
  links: "studio-approval-links",
} as const;

function useScope() {
  const { isAuthenticated, org, business } = useAuth();
  return { ready: isAuthenticated && !!org?._id && !!business?._id, org: org?._id ?? null, business: business?._id ?? null };
}

/** The batch grid's one read. Polled while products are still being made; a poll that fails keeps the grid as it was. */
export function useBatch(id: string | undefined) {
  const s = useScope();
  return useQuery<BatchView>({
    queryKey: [PRO_KEYS.batch, s.org, s.business, id ?? null],
    queryFn: () => studioApi.batch(id!),
    enabled: s.ready && !!id,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => (q.state.data?.status === "making" ? 4000 : false),
  });
}

/**
 * The one price of a batch and its receipts, asked when the confirm sheet opens (`enabled`) and kept fresh every five minutes while open. A switched-off
 * use case is `notReleased`, never an error and never a price. `error` is the api's own answer, so a product with no photo can say which.
 */
export function useBatchQuote(body: BatchBody | null, enabled: boolean): PressQuoteState & { quote: BatchQuote | undefined; error: unknown; refetch: () => Promise<unknown> } {
  const s = useScope();
  const on = enabled && s.ready && !!body && body.productIds.length > 0;
  const q = useQuery<BatchQuote>({
    queryKey: [PRO_KEYS.batchQuote, s.org, s.business, body?.productIds.join(",") ?? "", body?.count ?? null, body?.language ?? null],
    queryFn: () => studioApi.batchQuote(body!),
    enabled: on,
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchInterval: on ? 5 * 60 * 1000 : false,
  });
  const state = derivePressQuote({
    enabled: on,
    // eslint-disable-next-line react-hooks/purity -- reading the clock during render is how a lapsed receipt is withheld; the refetch above closes the window
    now: Date.now(),
    isFetching: q.isFetching,
    data: q.data,
    error: q.error,
  });
  return { ...state, quote: state.quote as BatchQuote | undefined, error: q.error, refetch: q.refetch };
}

/**
 * Start the batch: one click is one charge (one Idempotency-Key), with the receipts of the price that was shown. The balance and the running-jobs
 * strip refresh at once; a receipt that was used or refused is thrown away so the next press asks again.
 */
export function useCreateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { body: BatchBody; receipts: PressReceipts }) => studioApi.createBatch(v.body, v.receipts),
    onSettled: (_d, error) => {
      void qc.invalidateQueries({ queryKey: [CREDITS_KEY] });
      if (!error) void qc.invalidateQueries({ queryKey: jobsKeys.all });
      if (!error || (error as { code?: string }).code === "QUOTE_NOT_HONOURED") void qc.resetQueries({ queryKey: [PRO_KEYS.batchQuote] });
    },
  });
}

/** One bulk action, one request. The hearts changed, so the shortlist and every creative page refresh with the grid. */
export function useBatchAction(batchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { op: BatchOp; previewIds: string[]; reasons?: string[] }) => studioApi.batchAction(batchId, v.op, v.previewIds, v.reasons),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [PRO_KEYS.batch] });
      void qc.invalidateQueries({ queryKey: [FLOW_KEYS.shortlist] });
      void qc.invalidateQueries({ queryKey: [FLOW_KEYS.creative] });
    },
  });
}

/** The look history of a creative; asked for only while the sheet is open. */
export function useVersions(creativeId: string, enabled: boolean) {
  const s = useScope();
  return useQuery({
    queryKey: [PRO_KEYS.versions, s.org, s.business, creativeId],
    queryFn: () => studioApi.versions(creativeId),
    select: (r) => r.versions,
    enabled: enabled && s.ready,
    retry: false,
    staleTime: 0,
  });
}

/** Go back to an earlier look. The heart lapses (U2), so the creative page, the shortlist and the history all refresh. */
export function useRestore(creativeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { version: number; previewId: string }) => studioApi.restore(creativeId, v.version, v.previewId),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [PRO_KEYS.versions] });
      void qc.invalidateQueries({ queryKey: [FLOW_KEYS.creative] });
      void qc.invalidateQueries({ queryKey: [PRO_KEYS.batch] });
      void qc.invalidateQueries({ queryKey: [FLOW_KEYS.shortlist] });
    },
  });
}

export function useApprovalLinks(creativeId: string, enabled: boolean) {
  const s = useScope();
  return useQuery({
    queryKey: [PRO_KEYS.links, s.org, s.business, creativeId],
    queryFn: () => studioApi.approvalLinks(creativeId),
    select: (r) => r.links,
    enabled: enabled && s.ready,
    retry: false,
    staleTime: 0,
  });
}

export function useCreateApprovalLink(creativeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (previewId: string) => studioApi.createApprovalLink(creativeId, previewId),
    onSettled: () => void qc.invalidateQueries({ queryKey: [PRO_KEYS.links] }),
  });
}

export function useRevokeApprovalLink(creativeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) => studioApi.revokeApprovalLink(creativeId, linkId),
    onSettled: () => void qc.invalidateQueries({ queryKey: [PRO_KEYS.links] }),
  });
}
