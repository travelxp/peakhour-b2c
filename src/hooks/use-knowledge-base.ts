"use client";

import { INSIGHTS_KEY } from "@/hooks/use-insights";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import type { KbEntry, KbFindingsResponse, KbPayload, KbRequest, KbSuggestionsResponse } from "@/lib/knowledge-base";

/**
 * Knowledge base hooks (GET/POST/PATCH /v1/kb/*). The api scopes every call to
 * the session's pinned org AND business; nothing here names either.
 */

const ENTRIES_KEY = "kb-entries";
const REQUESTS_KEY = "kb-requests";
const SUGGESTIONS_KEY = "kb-suggestions";
const FINDINGS_KEY = "kb-findings";

export type EntryFilter = { source: "" | "owner" | "import" | "learned"; status: "active" | "archived"; q: string };

export function useKbEntries(filter: EntryFilter) {
  const { isAuthenticated, org, business } = useAuth();
  return useQuery<{ entries: KbEntry[]; total: number; channels: string[] }>({
    queryKey: [ENTRIES_KEY, org?._id ?? null, business?._id ?? null, filter],
    // keep the list on screen while the next search is fetched, rather than a skeleton per keystroke
    placeholderData: keepPreviousData,
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
  const { isAuthenticated, org, business } = useAuth();
  return useQuery<{ requests: KbRequest[] }>({
    queryKey: [REQUESTS_KEY, org?._id ?? null, business?._id ?? null],
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
    // an edit changes what the policy check says; an approval or a dismissal changes what is still suggested
    void qc.invalidateQueries({ queryKey: [SUGGESTIONS_KEY] });
    void qc.invalidateQueries({ queryKey: [FINDINGS_KEY] });
    // an answered question changes what Insights says is still open
    void qc.invalidateQueries({ queryKey: [INSIGHTS_KEY] });
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

/** GET /v1/kb/suggestions: the drafted answers (most-asked first) and what was routed to Catalog Manager and the Inbox. */
export function useKbSuggestions() {
  const { isAuthenticated, org, business } = useAuth();
  return useQuery<KbSuggestionsResponse>({
    queryKey: [SUGGESTIONS_KEY, org?._id ?? null, business?._id ?? null],
    queryFn: () => api.get("/v1/kb/suggestions"),
    enabled: isAuthenticated && !!org?._id,
    retry: false,
  });
}

/** The edited words are sent as they are; the api refuses (409/400, with its own sentence) while a [placeholder] remains or the entry limit is reached. */
export function useApproveSuggestion() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, title, content }: { id: string; title: string; content: string }) =>
      api.post<{ entry: KbEntry; answered: number }>(`/v1/kb/suggestions/${id}/approve`, { title, content }),
    onSuccess: refresh,
  });
}

export function useDismissSuggestion() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (id: string) => api.post<{ dismissed: number }>(`/v1/kb/suggestions/${id}/dismiss`),
    onSuccess: refresh,
  });
}

/** Save the edited words on the suggestion without approving it (the entry update). */
export function useSaveSuggestion() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, title, content }: { id: string; title: string; content: string }) => api.patch<{ entry: KbEntry }>(`/v1/kb/entries/${id}`, { title, content }),
    onSuccess: refresh,
  });
}

/** GET /v1/kb/findings?state=open|dismissed: what the policy check found. */
export function useKbFindings(state: "open" | "dismissed") {
  const { isAuthenticated, org, business } = useAuth();
  return useQuery<KbFindingsResponse>({
    queryKey: [FINDINGS_KEY, org?._id ?? null, business?._id ?? null, state],
    queryFn: () => api.get("/v1/kb/findings", { state, limit: "100" }),
    enabled: isAuthenticated && !!org?._id,
    retry: false,
  });
}

export function useFindingAction() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "dismiss" | "reopen" }) => api.post<{ finding: { id: string; state: string } }>(`/v1/kb/findings/${id}/${action}`),
    onSuccess: refresh,
  });
}
