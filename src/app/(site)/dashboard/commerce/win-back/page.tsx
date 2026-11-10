import type { Metadata } from "next";
import { WinBackPanel } from "@/components/commerce/win-back";
import { PageShell, PageHeader } from "@/components/dashboard/page-shell";
import { PageIntro } from "@/components/dashboard/page-intro";

export const metadata: Metadata = {
  title: "Win back carts · Commerce",
};

/**
 * Commerce -> Win back carts. WhatsApp reminders to shoppers who opted in and left a cart: the switch (off until turned on),
 * the timing and per-shopper limit, and the revenue it brought back, measured from Shopify's own completed checkouts.
 */
export default function CommerceWinBackPage() {
  return (
    <PageShell width="standard">
      <PageHeader
        title="Win back carts"
        description="Remind shoppers who opted in on WhatsApp about the cart they left, with a link back to it."
      />
      <PageIntro id="win-back" />
      <WinBackPanel />
    </PageShell>
  );
}
