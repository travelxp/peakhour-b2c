"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import type { KbEntry, KbPayload, KbRequest } from "@/lib/knowledge-base";

/**
 * Knowledge base hooks (GET/POST/PATCH /v1/kb/*). The api scopes every call to
 * the session's pinned org AND business; nothing here names either.
 */

const ENTRIES_KEY = "kb-entries";
const REQUESTS_KEY = "kb-requests";

export type EntryFilter = { source: "" | "owner" | "import" | "learned"; status: "active" | "archived"; q: string };

export function useKbEntries(filter: EntryFilter) {
  const { isAuthenticated, org } = useAuth();
  return useQuery<{ entries: KbEntry[]; total: number; channels: string[] }>({
    queryKey: [ENTRIES_KEY, org?._id ?? null, filter],
    queryFn: () => {
      const params: Record<string, string> = { status: filter.status, limit: "100" };
      if (filter.source) params.source = filter.source;
      if (filter.q.trim()) params.q = filter.q.trim();
      return api.get("/v1/kb/entries", params);
    },
    enabled: isAuthenticated && !!org?._id,
    retry: false,
  });
}

export function useKbRequests() {
  const { isAuthenticated, org } = useAuth();
  return useQuery<{ requests: KbRequest[] }>({
    queryKey: [REQUESTS_KEY, org?._id ?? null],
    queryFn: () => api.get("/v1/kb/requests"),
    enabled: isAuthenticated && !!org?._id,
    retry: false,
  });
}

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: [ENTRIES_KEY] });
    void qc.invalidateQueries({ queryKey: [REQUESTS_KEY] });
  };
}

export function useCreateKbEntry() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (p: KbPayload) => api.post<{ entry: KbEntry }>("/v1/kb/entries", p),
    onSuccess: refresh,
  });
}

export function useUpdateKbEntry() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: KbPayload }) => api.patch<{ entry: KbEntry }>(`/v1/kb/entries/${id}`, payload),
    onSuccess: refresh,
  });
}

export function useKbEntryAction() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "archive" | "restore" | "take-over" }) => api.post<{ entry: KbEntry }>(`/v1/kb/entries/${id}/${action}`),
    onSuccess: refresh,
  });
}

export function useAnswerKbRequest() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => api.post<{ entry: KbEntry; request: KbRequest }>(`/v1/kb/requests/${id}/answer`, { content }),
    onSuccess: refresh,
  });
}

export function useDismissKbRequest() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (id: string) => api.post<{ request: KbRequest }>(`/v1/kb/requests/${id}/dismiss`),
    onSuccess: refresh,
  });
}
