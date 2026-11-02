import type { Metadata } from "next";
import { DemandInsightsPanel } from "@/components/commerce/demand-insights";
import { PageShell, PageHeader } from "@/components/dashboard/page-shell";

export const metadata: Metadata = {
  title: "What shoppers asked for · Commerce",
};

/**
 * Commerce -> What shoppers asked for. The requests your assistant could not
 * meet, why it missed, and the one tap that fixes each in your Shopify admin.
 */
export default function CommerceDemandPage() {
  return (
    <PageShell width="standard">
      <PageHeader
        title="What shoppers asked for"
        description="Things shoppers asked your assistant for that your catalog could not supply, with how often and what to do about it."
      />
      <DemandInsightsPanel />
    </PageShell>
  );
}
