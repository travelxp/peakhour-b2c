"use client";

import { INSIGHTS_KEY } from "@/hooks/use-insights";
import { CREDITS_KEY } from "@/hooks/use-credits";
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, newActionKey } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import {
  FINDINGS_POLL_MS,
  clickHeaders,
  marketsParam,
  type ApproveResponse,
  type CapabilitiesResponse,
  type GenerateResponse,
  type MarketCheck,
  type PoliciesResponse,
  type PolicyPrice,
  type PolicyRow,
  type PolicyType,
  type Publication,
  type QuestionsResponse,
  type SaveBody,
  type UploadPrice,
  type UploadSummary,
} from "@/lib/policy-builder";
import { FINDINGS_PAGE, KB_LIST_LIMIT, type KbFinding, type KbEntry, type KbFindingsResponse, type KbPayload, type KbRequest, type KbSuggestionsResponse } from "@/lib/knowledge-base";

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
      const params: Record<string, string> = { status: filter.status, limit: String(KB_LIST_LIMIT) };
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
    // an approved policy draft makes its policy row live (KE-2.10)
    void qc.invalidateQueries({ queryKey: [POLICIES_KEY] });
    void qc.invalidateQueries({ queryKey: [POLICY_QUESTIONS_KEY] });
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

/** GET /v1/kb/findings?state=open|dismissed, a page at a time (skip): the api orders them by severity then recency across pages, so a later page continues the order. */
export function useKbFindings(state: "open" | "dismissed") {
  const { isAuthenticated, org, business } = useAuth();
  return useInfiniteQuery({
    queryKey: [FINDINGS_KEY, org?._id ?? null, business?._id ?? null, state],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.get<KbFindingsResponse>("/v1/kb/findings", { state, limit: String(FINDINGS_PAGE), skip: String(pageParam) }),
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.findings.length, 0);
      return last.findings.length > 0 && loaded < last.total ? loaded : undefined;
    },
    select: (d): { findings: KbFinding[]; total: number } => {
      const seen = new Set<string>();
      const findings = d.pages.flatMap((p) => p.findings).filter((f) => !seen.has(f.id) && seen.add(f.id));
      return { findings, total: d.pages[d.pages.length - 1]?.total ?? findings.length };
    },
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

// -- Policies (KE-2.10) ------------------------------------------------------------------------------------------------
// The api (`/v1/kb/policies/*`, `/v1/kb/upload`, `/v1/kb/publish/*`) is the authority; these only carry its answers.

const POLICIES_KEY = "kb-policies";
const POLICY_QUESTIONS_KEY = "kb-policy-questions";
const POLICY_PRICE_KEY = "kb-policy-price";
const POLICY_FINDINGS_KEY = "kb-policy-findings";
const UPLOAD_PRICE_KEY = "kb-upload-price";
const CAPABILITIES_KEY = "kb-capabilities";
const PUBLICATIONS_KEY = "kb-publications";

/** GET /v1/kb/policies: the business's policy rows by type, and the types it has none for. */
export function useKbPolicies() {
  const { isAuthenticated, org, business } = useAuth();
  return useQuery<PoliciesResponse>({
    queryKey: [POLICIES_KEY, org?._id ?? null, business?._id ?? null],
    queryFn: () => api.get("/v1/kb/policies"),
    enabled: isAuthenticated && !!org?._id,
    retry: false,
  });
}

/** GET /v1/kb/policies/:type/questions?markets=: the questions, with what is known and what is answered. Free. */
export function usePolicyQuestions(type: PolicyType, markets: readonly string[]) {
  const { isAuthenticated, org, business } = useAuth();
  return useQuery<QuestionsResponse>({
    queryKey: [POLICY_QUESTIONS_KEY, org?._id ?? null, business?._id ?? null, type, marketsParam(markets)],
    queryFn: () => api.get(`/v1/kb/policies/${type}/questions`, marketsParam(markets)),
    enabled: isAuthenticated && !!org?._id,
    retry: false,
    // the merchant's boxes are not overwritten by a refetch: the editor reads the answers once per (type, markets)
    refetchOnWindowFocus: false,
  });
}

/** PUT /v1/kb/policies/:type: save the answers as the draft policy (free; writes no text and publishes nothing). */
export function useSavePolicyAnswers(type: PolicyType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveBody) => api.put<{ policy: PolicyRow }>(`/v1/kb/policies/${type}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [POLICIES_KEY] });
      void qc.invalidateQueries({ queryKey: [POLICY_PRICE_KEY] });
    },
  });
}

/** GET .../generate/price: the price shown before the click, the balance check and a signed quote. Always fresh: a stale price is a wrong price. */
export function usePolicyPrice(type: PolicyType, markets: readonly string[], enabled = true) {
  const { isAuthenticated, org, business } = useAuth();
  return useQuery<PolicyPrice>({
    queryKey: [POLICY_PRICE_KEY, org?._id ?? null, business?._id ?? null, type, marketsParam(markets)],
    queryFn: () => api.get(`/v1/kb/policies/${type}/generate/price`, marketsParam(markets)),
    enabled: enabled && isAuthenticated && !!org?._id,
    retry: false,
    staleTime: 0,
  });
}

/**
 * POST .../generate. ONE CLICK, ONE KEY: `clickHeaders` mints a new `Idempotency-Key` inside `mutationFn`, so each call of `mutate` is one click and a retry of a
 * failed click is a new one. The signed quote from the price card travels as `x-peaks-quote` so the price shown is the price charged.
 */
export function useGeneratePolicy(type: PolicyType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ markets, quoteToken }: { markets: readonly string[]; quoteToken?: string }) =>
      api.post<GenerateResponse>(`/v1/kb/policies/${type}/generate`, markets.length > 0 ? { markets: [...markets] } : {}, clickHeaders(quoteToken, newActionKey)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [SUGGESTIONS_KEY] });
      void qc.invalidateQueries({ queryKey: [ENTRIES_KEY] });
      void qc.invalidateQueries({ queryKey: [POLICY_PRICE_KEY] });
      // the Peaks balance the rest of the dashboard shows
      void qc.invalidateQueries({ queryKey: [CREDITS_KEY] });
    },
  });
}

/** GET .../generate/findings: the market findings of the current draft, read again while the generate reply said "pending". Free; stops after a few tries. */
export function usePolicyFindings(type: PolicyType, markets: readonly string[], enabled: boolean) {
  const { isAuthenticated, org, business } = useAuth();
  return useQuery<{ marketCheck: "done"; marketFindings: MarketCheck }>({
    queryKey: [POLICY_FINDINGS_KEY, org?._id ?? null, business?._id ?? null, type, marketsParam(markets)],
    queryFn: () => api.get(`/v1/kb/policies/${type}/generate/findings`, marketsParam(markets)),
    enabled: enabled && isAuthenticated && !!org?._id,
    retry: false,
    refetchInterval: (q) => (q.state.data || q.state.errorUpdateCount > 0 ? false : FINDINGS_POLL_MS),
    gcTime: 0,
  });
}

/** Approve the written draft (the existing suggestions route). Also refreshes the policy rows: a generated approval makes its policy row live. */
export function useApprovePolicyDraft() {
  const refresh = useRefresh();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title, content }: { id: string; title: string; content: string }) => api.post<ApproveResponse>(`/v1/kb/suggestions/${id}/approve`, { title, content }),
    onSuccess: () => {
      refresh();
      void qc.invalidateQueries({ queryKey: [CAPABILITIES_KEY] });
    },
  });
}

/** GET /v1/kb/upload/price: the price of reading one document, with the signed quote and the limits. Free. */
export function useUploadPrice() {
  const { isAuthenticated, org, business } = useAuth();
  return useQuery<UploadPrice>({
    queryKey: [UPLOAD_PRICE_KEY, org?._id ?? null, business?._id ?? null],
    queryFn: () => api.get("/v1/kb/upload/price"),
    enabled: isAuthenticated && !!org?._id,
    retry: false,
    staleTime: 0,
  });
}

/** POST /v1/kb/upload: one Drive file or one page address, charged only when something is delivered. One click, one `Idempotency-Key`. */
export function useUploadKnowledge() {
  const refresh = useRefresh();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, quoteToken }: { body: { driveFileId: string } | { url: string }; quoteToken?: string }) =>
      api.post<UploadSummary>("/v1/kb/upload", body, clickHeaders(quoteToken, newActionKey)),
    onSuccess: () => {
      refresh();
      void qc.invalidateQueries({ queryKey: [UPLOAD_PRICE_KEY] });
      void qc.invalidateQueries({ queryKey: [CREDITS_KEY] });
    },
  });
}

/** GET /v1/kb/publish/capabilities: every connected channel, its connections and what each slot allows. The Publish buttons are drawn from this and nothing else. */
export function useKbCapabilities() {
  const { isAuthenticated, org, business } = useAuth();
  return useQuery<CapabilitiesResponse>({
    queryKey: [CAPABILITIES_KEY, org?._id ?? null, business?._id ?? null],
    queryFn: () => api.get("/v1/kb/publish/capabilities"),
    enabled: isAuthenticated && !!org?._id,
    retry: false,
  });
}

/** GET /v1/kb/entries/:id/publications?check=1: where the entry is published, each copy read back and compared with what Peakhour sent. */
export function useKbPublications(entryId: string | null) {
  const { isAuthenticated, org, business } = useAuth();
  return useQuery<{ publications: Publication[] }>({
    queryKey: [PUBLICATIONS_KEY, org?._id ?? null, business?._id ?? null, entryId],
    queryFn: () => api.get(`/v1/kb/entries/${entryId}/publications`, { check: "1" }),
    enabled: isAuthenticated && !!org?._id && !!entryId,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

function useRefreshPublications() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: [PUBLICATIONS_KEY] });
    void qc.invalidateQueries({ queryKey: [CAPABILITIES_KEY] });
    void qc.invalidateQueries({ queryKey: [ENTRIES_KEY] });
    void qc.invalidateQueries({ queryKey: [SUGGESTIONS_KEY] });
  };
}

export function usePublishEntry() {
  const refresh = useRefreshPublications();
  return useMutation({
    mutationFn: ({ id, channel, slot, connectionId }: { id: string; channel: string; slot: string; connectionId?: string }) =>
      api.post<{ publication: Publication }>(`/v1/kb/entries/${id}/publish`, { channel, slot, ...(connectionId ? { connectionId } : {}) }),
    onSuccess: refresh,
    // a refusal (DIVERGED, GRANT_MISSING) changes what the panel should show too
    onError: refresh,
  });
}

export function useResolvePublication() {
  const refresh = useRefreshPublications();
  return useMutation({
    mutationFn: ({ id, keep }: { id: string; keep: "ours" | "theirs" }) =>
      api.post<{ keep: "ours" | "theirs"; publication?: Publication; draftEntryId?: string }>(`/v1/kb/publications/${id}/resolve`, { keep }),
    onSuccess: refresh,
  });
}

export function useUnpublish() {
  const refresh = useRefreshPublications();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ removedFromChannel: boolean; keptChannelText: boolean }>(`/v1/kb/publications/${id}`),
    onSuccess: refresh,
  });
}
