import type { ReactNode } from "react";

/**
 * Root layout for the Shopify commerce surface — /shopify/** (route groups
 * don't affect URLs). One of this app's multiple root layouts: (site)/ owns
 * the marketing/dashboard shell (Tailwind, fonts, providers); this one is a
 * bare shell so the Polaris route trees inherit no Tailwind preflight.
 *
 * Requirement 2.2.3 (Shopify App Store): App Bridge must be loaded from
 * Shopify's CDN as a PLAIN synchronous <script> — no async/defer, no
 * next/script injection — and be the FIRST script in <head>. App Bridge
 * reads the app's client id from the `shopify-api-key` meta tag at load
 * time, so the meta tag must precede the script.
 *
 * The /shopify/connect tree runs outside the Shopify admin iframe and
 * doesn't use App Bridge — loading the script there is harmless (it no-ops
 * without an embedded context).
 *
 * Set NEXT_PUBLIC_SHOPIFY_API_KEY to the app's client id (= shopify.app.toml
 * client_id — public, safe to expose).
 */

const SHOPIFY_API_KEY = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ?? "";

/**
 * Force per-request rendering for the whole /shopify/** tree.
 *
 * The middleware serves a nonce-based CSP (`script-src 'self' 'nonce-…'
 * https://cdn.shopify.com`), and Next.js can only stamp that nonce onto its
 * inline bootstrap scripts when the page renders DYNAMICALLY. These routes
 * are pure client components with no cookie/header reads, so they were
 * statically prerendered at build time — nonce-less inline scripts that the
 * per-request CSP then blocked, freezing every embedded page on its loading
 * skeleton inside the Shopify admin (zero hydration, zero API calls; field
 * bug 2026-06-12). The (site) tree never hit this because its auth-cookie
 * reads already force dynamic rendering.
 */
export const dynamic = "force-dynamic";

export default function CommerceRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {SHOPIFY_API_KEY ? (
          <meta name="shopify-api-key" content={SHOPIFY_API_KEY} />
        ) : null}
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- requirement
            2.2.3 mandates a synchronous, non-deferred App Bridge script. */}
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
      </head>
      <body>{children}</body>
    </html>
  );
}
