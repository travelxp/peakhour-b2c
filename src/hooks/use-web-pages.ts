"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PageBlock, MarketingPageSeo } from "@/lib/marketing-pages";

// ── Types (mirror the /v1/content/web-pages API) ─────────────────────────────

export interface WebPageTaxonomy {
  industry?: string;
  persona?: string;
  pillar?: string;
}

export interface WebPageAiTrace {
  generated?: boolean;
  groundingVerified?: boolean;
}

/** The authored page carried on a cnt_drafts.webPage draft. `blocks` is present
 *  only on the single-draft detail fetch (the list omits it — it's heavy). */
export interface WebPageContent {
  slug: string;
  locale: string;
  kind: string;
  name?: string;
  taxonomy?: WebPageTaxonomy;
  seo?: MarketingPageSeo;
  ai?: WebPageAiTrace;
  blocks?: PageBlock[];
}

export interface WebPageLastPublishError {
  code: string;
  message?: string;
  at?: string;
}

export interface WebPageDraft {
  _id: string;
  title?: string;
  webPage: WebPageContent;
  sourceMetadata?: {
    groundingUnsupportedClaims?: string[];
    lastPublishError?: WebPageLastPublishError;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface PendingWebPages {
  rows: WebPageDraft[];
  total: number;
  skip: number;
  limit: number;
}

export interface GenerateOutcome {
  slug: string | null;
  draftId?: string;
  kind?: string;
  previewName?: string;
  groundingVerified?: boolean;
  unsupportedClaims?: string[];
  skippedReason?: string;
  error?: string;
}

export interface GenerateResult {
  businessId: string;
  groundingSource: "platform_catalog" | "business_profile" | "empty";
  outcomes: GenerateOutcome[];
}

export interface PublishResult {
  pageId: string;
  slug: string;
  locale: string;
  created: boolean;
  version: number;
}

// ── Query keys ───────────────────────────────────────────────────────────────

export const webPagesKeys = {
  all: ["web-pages"] as const,
  pending: () => ["web-pages", "pending"] as const,
  detail: (id: string) => ["web-pages", "detail", id] as const,
};

// ── Hooks ──────────────────────────────────────────────────────────────────

/** The caller's own review queue — pages waiting to be approved or sent back.
 *  Fetches the API's max page (50); the UI shows a "showing first N" note if the
 *  business somehow has more pending than that (they clear as they're actioned). */
export function usePendingWebPages(limit = 50) {
  return useQuery({
    queryKey: webPagesKeys.pending(),
    queryFn: () => api.get<PendingWebPages>("/v1/content/web-pages/pending", { limit: String(limit) }),
  });
}

/** One draft in full (incl. blocks) for the review/preview screen. */
export function useWebPageDraft(id: string | null | undefined) {
  return useQuery({
    queryKey: id ? webPagesKeys.detail(id) : ["web-pages", "detail", "__noop__"],
    queryFn: () => api.get<WebPageDraft>(`/v1/content/web-pages/${id}`),
    enabled: !!id,
  });
}

/** POST /generate — compose new pages. Omit segments → the platform org uses its
 *  seed segments; a customer must supply its own. */
export function useGenerateWebPages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body?: { segments?: unknown[]; dryRun?: boolean }) =>
      api.post<GenerateResult>("/v1/content/web-pages/generate", body ?? {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: webPagesKeys.all }),
  });
}

/** POST /:id/approve — approve → publish live. */
export function useApproveWebPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<PublishResult>(`/v1/content/web-pages/${id}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: webPagesKeys.all }),
  });
}

/** POST /:id/reject — send a page back (it won't be published). */
export function useRejectWebPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.post(`/v1/content/web-pages/${id}/reject`, reason ? { reason } : {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: webPagesKeys.all }),
  });
}
