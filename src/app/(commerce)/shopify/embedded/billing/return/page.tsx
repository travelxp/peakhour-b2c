"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Page,
  Card,
  BlockStack,
  Text,
  Button,
  Banner,
  Spinner,
  InlineStack,
  SkeletonPage,
} from "@shopify/polaris";
import { getSessionToken } from "../../_lib/session";

/**
 * Shopify Billing return page (SB-2d).
 *
 * After the merchant approves the charge on Shopify's hosted billing page,
 * Shopify redirects the TOP window to our `returnUrl` — so this page loads
 * STANDALONE (the whole tab is on our host, NOT inside the admin iframe),
 * where App Bridge can't mint a session token (`idToken()` never resolves
 * outside admin — see _lib/session.ts). The `commerce.assistant` entitlement
 * is granted server-side by the `app_subscriptions/update` webhook (SB-2b), so
 * this page's job is NOT to reconcile here — it's to return the merchant into
 * the embedded app INSIDE Shopify admin (where the now-active subscription
 * shows). We bounce to the admin app deep link built from the shop + the
 * public API key. A best-effort confirm runs first in case we ever DO load
 * in-frame (a working token), but it never blocks the bounce.
 *
 * (Previously this page tried to confirm via App Bridge and then did
 * `window.top.location.href = "/shopify/embedded"` — both broken standalone:
 * confirm failed for lack of a token, and the relative top-redirect resolved
 * against the admin origin. Hence merchants were stranded post-payment.)
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const SHOPIFY_API_KEY = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ?? "";

/** The Shopify-admin deep link that re-opens our embedded app for this store,
 *  built from the shop (→ store handle) + the public API key (= client id).
 *  App Bridge then initializes inside admin and the embedded surface can
 *  authenticate. Falls back to the (standalone) Peakhour dashboard if we can't
 *  build a deep link (missing shop or API key) — a relative path, which
 *  resolves against our own origin on this top-level page. */
function adminAppUrl(shop: string): string {
  const handle = shop.replace(/\.myshopify\.com$/, "");
  if (handle && SHOPIFY_API_KEY) {
    return `https://admin.shopify.com/store/${handle}/apps/${SHOPIFY_API_KEY}`;
  }
  return "/dashboard";
}

function ShopifyBillingReturn() {
  const searchParams = useSearchParams();
  const dest = adminAppUrl(searchParams.get("shop") ?? "");

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    (async () => {
      // Best-effort reconcile ONLY if we happen to have a working App Bridge
      // token (true only when loaded in-frame). Short timeout so the common
      // standalone case — where idToken() never resolves — doesn't stall the
      // return. The webhook is the authoritative grant either way.
      const token = await getSessionToken(2500);
      if (cancelled) return;
      if (token) {
        try {
          await fetch(`${API_URL}/v1/shopify/embedded/billing/confirm`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            signal: ctrl.signal,
          });
        } catch {
          // Non-fatal — the app_subscriptions/update webhook grants the
          // entitlement; this call is just an immediacy optimisation.
        }
      }
      if (cancelled) return;
      // Return the merchant into the embedded app inside Shopify admin. Use
      // replace() so this single-use return page isn't left in back-history
      // (a Back press would otherwise just re-bounce through here).
      (window.top ?? window).location.replace(dest);
    })();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [dest]);

  return (
    <Page title="Peakhour Commerce">
      <Card>
        <BlockStack gap="500">
          <Banner tone="success" title="Subscription confirmed!">
            <Text as="p" variant="bodyMd">
              Your Commerce Assistant is being activated. Taking you back to
              Peakhour in your Shopify admin…
            </Text>
          </Banner>
          <BlockStack gap="300" inlineAlign="center">
            <Spinner size="small" accessibilityLabel="Returning to Peakhour" />
          </BlockStack>
          <InlineStack align="start">
            {/* Manual fallback — absolute admin deep link, opened at the top
                level so it escapes any frame and re-enters the admin app. */}
            <Button url={dest} variant="primary" external>
              Back to Peakhour Commerce
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>
    </Page>
  );
}

// useSearchParams() must sit under a Suspense boundary (Next.js build
// requirement). The page renders instantly then redirects, so the fallback is
// only a flash.
export default function ShopifyBillingReturnPage() {
  return (
    <Suspense fallback={<SkeletonPage title="Peakhour Commerce" />}>
      <ShopifyBillingReturn />
    </Suspense>
  );
}
