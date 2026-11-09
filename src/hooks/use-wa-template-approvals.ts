"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import type { TemplateApprovals } from "@/lib/wa-template-approvals";

/**
 * Which WhatsApp messages Meta must approve for this business, and where each stands. Read-only: Peakhour sends them to Meta
 * itself, so there is nothing for the merchant to submit. The Shopify admin reads the same list from the same api function.
 * Refreshes every minute until every message is approved, so an approval (or a retry after a rejection) shows without a reload.
 */
export function useWaTemplateApprovals() {
  const { isAuthenticated, org, business } = useAuth();
  return useQuery<TemplateApprovals>({
    queryKey: ["wa-template-approvals", org?._id ?? null, business?._id ?? null],
    queryFn: () => api.get<TemplateApprovals>("/v1/meta/whatsapp/template-approvals"),
    enabled: isAuthenticated && !!org?._id && !!business?._id,
    retry: false,
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d?.connected || d.templates.length === 0 || d.allApproved) return false;
      // A minute while Meta is still reviewing; five once nothing is waiting (a rejection Peakhour is still retrying).
      return d.counts.waiting > 0 ? 60_000 : 300_000;
    },
  });
}
