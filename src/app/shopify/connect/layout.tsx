import type { ReactNode } from "react";
import "@shopify/polaris/build/esm/styles.css";
import { ConnectShell } from "./_components/connect-shell";

/**
 * Layout for the /shopify/connect bridge page.
 *
 * Sits outside (site)/ so it inherits only the bare root <html><body>
 * shell — no Tailwind preflight, no ThemeProvider. Polaris styles are
 * loaded here, isolated to this route tree.
 *
 * No App Bridge script: this page runs in a regular browser tab, not
 * inside the Shopify admin iframe. The merchant arrives here from the
 * OAuth callback to sign in / create a Peakhour account before the
 * embedded surface is accessible.
 */
export default function ShopifyConnectLayout({ children }: { children: ReactNode }) {
  return <ConnectShell>{children}</ConnectShell>;
}
