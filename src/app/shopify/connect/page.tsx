import type { Metadata } from "next";
import { ConnectWizard } from "./_components/connect-wizard";

export const metadata: Metadata = {
  title: "Connect your store — Peakhour Commerce",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ shop?: string; token?: string; reconnect?: string }>;
}

/**
 * Bridge page for the App Store install flow.
 *
 * Merchants land here from the OAuth callback when they don't yet have
 * a Peakhour session (fresh install). They sign in or create an account,
 * then the wizard calls POST /v1/integrations/shopify/link to exchange
 * the linkToken for a permanent int_connections record, before
 * redirecting to the embedded admin surface (/shopify/embedded).
 *
 * Not embedded — runs as a regular browser page, no App Bridge.
 * Uses Polaris only (no Tailwind) via the connect/ segment layout.
 */
export default async function ShopifyConnectPage({ searchParams }: Props) {
  const { shop = "", token = "", reconnect = "" } = await searchParams;
  return <ConnectWizard shop={shop} token={token} reconnect={reconnect === "1"} />;
}
