import Script from "next/script";
import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Embedded Shopify admin surface (shopify-app-submission-plan.md §SE).
 *
 * Loaded inside an iframe by admin.shopify.com (the middleware grants these
 * routes a `frame-ancestors https://admin.shopify.com` CSP and exempts them
 * from the coming-soon gate). App Bridge v4 is loaded from Shopify's CDN and
 * reads the app's client id (API key) from the `shopify-api-key` meta tag,
 * then exposes `window.shopify` (incl. `idToken()` for per-request auth).
 *
 * Set NEXT_PUBLIC_SHOPIFY_API_KEY to the app's client id (public — it travels
 * in every authorize URL; it is the same value as shopify.app.toml client_id).
 */

const SHOPIFY_API_KEY = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ?? "";

export const metadata: Metadata = {
  // Placed in <head> by Next's metadata API — App Bridge reads this at load.
  other: SHOPIFY_API_KEY ? { "shopify-api-key": SHOPIFY_API_KEY } : {},
};

export default function ShopifyEmbeddedLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
      <div className="min-h-screen bg-white text-neutral-900">{children}</div>
    </>
  );
}
