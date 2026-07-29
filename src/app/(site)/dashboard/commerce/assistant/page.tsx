import type { Metadata } from "next";
import { CommerceAssistantPreview } from "@/components/commerce/assistant-preview";
import { PageShell, PageHeader } from "@/components/dashboard/page-shell";

export const metadata: Metadata = {
  title: "Assistant preview · Commerce",
};

/**
 * Commerce → Assistant preview (shopify-app-submission-plan.md §S5).
 * Try the catalog-grounded WhatsApp assistant against your connected store's
 * real catalog, right from the dashboard — no live WhatsApp number needed.
 */
export default function CommerceAssistantPreviewPage() {
  return (
    <PageShell width="narrow">
      <PageHeader
        title="Assistant preview"
        description="This is the same catalog-grounded assistant that answers your customers on WhatsApp, running against your connected store. Ask it anything a shopper might — in any language. It only states facts from your real product catalog."
      />
      <CommerceAssistantPreview />
    </PageShell>
  );
}
