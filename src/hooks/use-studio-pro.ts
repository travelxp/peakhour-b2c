"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { studioApi, type BatchOp, type BatchView } from "@/lib/api/creative-studio";
import { FLOW_KEYS } from "@/hooks/use-studio-flow";
import { useAuth } from "@/providers/auth-provider";

/** Query keys for the Pro tools screens (S16 to S18), in one place so a mutation can name the ones it changes. */
export const PRO_KEYS = {
  batch: "studio-batch",
  versions: "studio-versions",
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
