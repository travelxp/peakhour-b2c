import type { ReactNode } from "react";
import "@shopify/polaris/build/esm/styles.css";
import { ConnectShell } from "./_components/connect-shell";

/**
 * Layout for the /shopify/connect bridge page.
 *
 * Sits under the (commerce) root layout, outside (site)/, so it inherits
 * a bare <html><body> shell — no Tailwind preflight, no ThemeProvider.
 * Polaris styles are loaded here, isolated to this route tree.
 *
 * This page runs in a regular browser tab, not inside the Shopify admin
 * iframe, and doesn't use App Bridge — the script the (commerce) root
 * layout loads in <head> simply no-ops here. The merchant arrives from
 * the OAuth callback to sign in / create a Peakhour account before the
 * embedded surface is accessible.
 */
export default function ShopifyConnectLayout({ children }: { children: ReactNode }) {
  return <ConnectShell>{children}</ConnectShell>;
}
