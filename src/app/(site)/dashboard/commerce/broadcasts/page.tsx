import type { Metadata } from "next";
import { BroadcastsPanel } from "@/components/commerce/broadcasts";
import { PageShell, PageHeader } from "@/components/dashboard/page-shell";

export const metadata: Metadata = {
  title: "Broadcasts · Commerce",
};

/**
 * Commerce -> Broadcasts. An approved WhatsApp marketing template to shoppers who opted in: review the audience and an
 * estimated Meta cost, confirm, and watch the results. A broadcast cannot be undone once it starts.
 */
export default function CommerceBroadcastsPage() {
  return (
    <PageShell width="standard">
      <PageHeader
        title="Broadcasts"
        description="Send an offer on WhatsApp to shoppers who opted in, and see how it did."
      />
      <BroadcastsPanel />
    </PageShell>
  );
}
