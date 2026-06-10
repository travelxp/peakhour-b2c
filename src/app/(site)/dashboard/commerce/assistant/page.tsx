import type { Metadata } from "next";
import { CommerceAssistantPreview } from "@/components/commerce/assistant-preview";

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
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Assistant preview</h1>
        <p className="mt-1 text-sm text-neutral-500">
          This is the same catalog-grounded assistant that answers your customers on WhatsApp,
          running against your connected store. Ask it anything a shopper might — in any language.
          It only states facts from your real product catalog.
        </p>
      </header>
      <CommerceAssistantPreview />
    </div>
  );
}
