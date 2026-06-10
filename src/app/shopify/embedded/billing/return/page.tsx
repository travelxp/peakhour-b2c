"use client";

import { useEffect, useState } from "react";
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
 * Shopify redirects here (the app's `returnUrl`). We get a fresh App Bridge
 * session token, call `billing/confirm` to reconcile the subscription and
 * grant the `commerce.assistant` entitlement, then redirect home.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

type State =
  | { status: "confirming" }
  | { status: "active" }
  | { status: "inactive" }
  | { status: "error"; message: string };

export default function ShopifyBillingReturn() {
  const [state, setState] = useState<State>({ status: "confirming" });
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      const token = await getSessionToken();
      if (ctrl.signal.aborted) return;
      if (!token) {
        setState({ status: "error", message: "Couldn't confirm — please reopen from your Shopify admin." });
        return;
      }
      try {
        const res = await fetch(`${API_URL}/v1/shopify/embedded/billing/confirm`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          signal: ctrl.signal,
        });
        if (ctrl.signal.aborted) return;
        if (!res.ok) {
          setState({ status: "error", message: "Couldn't confirm your subscription. Please try again." });
          return;
        }
        const data = (await res.json()) as { active?: boolean };
        setState({ status: data.active ? "active" : "inactive" });
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        setState({ status: "error", message: "Network error confirming your subscription." });
      }
    })();
    return () => ctrl.abort();
  }, []);

  // Auto-redirect to home 2 s after successful confirmation.
  // Use window.top navigation — router.replace only navigates the iframe.
  useEffect(() => {
    if (state.status !== "active") return;
    const t = setTimeout(() => { (window.top ?? window).location.href = "/shopify/embedded"; }, 2000);
    return () => clearTimeout(t);
  }, [state.status]);

  // ── Confirming ────────────────────────────────────────────────────────────

  if (state.status === "confirming") {
    return (
      <SkeletonPage title="Confirming subscription…">
        <Card>
          <BlockStack gap="500" inlineAlign="center">
            <Spinner size="large" />
            <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
              Confirming your subscription with Shopify…
            </Text>
          </BlockStack>
        </Card>
      </SkeletonPage>
    );
  }

  // ── Post-confirm states ───────────────────────────────────────────────────

  return (
    <Page title="Peakhour Commerce">
      <Card>
        <BlockStack gap="500">
          {state.status === "active" && (
            <>
              <Banner tone="success" title="Commerce Assistant is now active!">
                <Text as="p" variant="bodyMd">
                  Your catalog-grounded WhatsApp assistant is live. Redirecting you back…
                </Text>
              </Banner>
              <InlineStack align="start">
                <Button url="/shopify/embedded" variant="primary">
                  Back to Peakhour Commerce
                </Button>
              </InlineStack>
            </>
          )}

          {state.status === "inactive" && (
            <>
              <Banner tone="warning" title="Subscription not confirmed yet">
                <Text as="p" variant="bodyMd">
                  We couldn&apos;t find an active subscription. If you just approved it, give
                  it a moment and refresh — or contact support if this persists.
                </Text>
              </Banner>
              <InlineStack align="start">
                <Button url="/shopify/embedded/subscription" variant="plain">
                  Back to subscription page
                </Button>
              </InlineStack>
            </>
          )}

          {state.status === "error" && (
            <>
              <Banner tone="critical" title="Something went wrong">
                <Text as="p" variant="bodyMd">{state.message}</Text>
              </Banner>
              <InlineStack align="start">
                <Button url="/shopify/embedded/subscription" variant="plain">
                  Back to subscription page
                </Button>
              </InlineStack>
            </>
          )}
        </BlockStack>
      </Card>
    </Page>
  );
}
