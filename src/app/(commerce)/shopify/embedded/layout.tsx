import type { ReactNode } from "react";
import "@shopify/polaris/build/esm/styles.css";
import "./_styles/motion.css";
import { PolarisShell } from "./_components/polaris-shell";

/**
 * Embedded Shopify admin surface — Phase 1 Embedded Core.
 *
 * Loaded inside an iframe by admin.shopify.com. App Bridge v4 is loaded by
 * the (commerce) root layout as a synchronous, first-in-<head> script per
 * requirement 2.2.3; it reads the app's client id from the `shopify-api-key`
 * meta tag (also rendered there), then exposes `window.shopify`
 * (incl. `idToken()` for per-request auth).
 *
 * All styling in this route tree uses Polaris exclusively — no Tailwind classes.
 * The middleware already sets `frame-ancestors https://admin.shopify.com` CSP and
 * exempts these routes from the coming-soon gate.
 */
export default function ShopifyEmbeddedLayout({ children }: { children: ReactNode }) {
  return <PolarisShell>{children}</PolarisShell>;
}
