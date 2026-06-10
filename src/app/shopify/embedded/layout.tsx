import Script from "next/script";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@shopify/polaris/build/esm/styles.css";
import { PolarisShell } from "./_components/polaris-shell";

/**
 * Embedded Shopify admin surface — Phase 1 Embedded Core.
 *
 * Loaded inside an iframe by admin.shopify.com. App Bridge v4 is loaded from
 * Shopify's CDN and reads the app's client id from the `shopify-api-key` meta
 * tag, then exposes `window.shopify` (incl. `idToken()` for per-request auth).
 *
 * All styling in this route tree uses Polaris exclusively — no Tailwind classes.
 * The middleware already sets `frame-ancestors https://admin.shopify.com` CSP and
 * exempts these routes from the coming-soon gate.
 *
 * Set NEXT_PUBLIC_SHOPIFY_API_KEY to the app's client id (= shopify.app.toml
 * client_id — public, safe to expose).
 */

const SHOPIFY_API_KEY = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ?? "";

export const metadata: Metadata = {
  other: SHOPIFY_API_KEY ? { "shopify-api-key": SHOPIFY_API_KEY } : {},
};

export default function ShopifyEmbeddedLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
      <PolarisShell>{children}</PolarisShell>
    </>
  );
}
