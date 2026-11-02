import type { Metadata } from "next";
import { KnowledgeBase } from "@/components/commerce/knowledge-base";
import { PageShell, PageHeader } from "@/components/dashboard/page-shell";

export const metadata: Metadata = {
  title: "Knowledge base · Commerce",
};

/**
 * Commerce -> Knowledge base. The answers your assistant gives beyond the
 * catalog (WhatsApp and your storefront chat), the questions it could not
 * answer, and your imported store policies.
 */
export default function CommerceKnowledgePage() {
  return (
    <PageShell width="standard">
      <PageHeader
        title="Knowledge base"
        description="What your assistant knows about your business beyond the catalog. It answers shoppers from these entries and, when it does not know, asks you here instead of guessing."
      />
      <KnowledgeBase />
    </PageShell>
  );
}
