"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Page,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Banner,
  Badge,
  Box,
  Divider,
  List,
  SkeletonPage,
  SkeletonBodyText,
  SkeletonDisplayText,
} from "@shopify/polaris";
import { getSessionToken } from "../_lib/session";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// ── Types ──────────────────────────────────────────────────────────────────

interface ContextData {
  connected: boolean;
  shop: string;
  storeName?: string | null;
  assistantActive?: boolean;
  pricing?: {
    displayName: string;
    amount: string;
    currency: string;
    interval: "monthly" | "annual";
  } | null;
}

type PageState = "loading" | "error" | "ready";

// ── Helpers ────────────────────────────────────────────────────────────────

const FEATURES = [
  "Catalog-grounded WhatsApp assistant — answers from your real products",
  "Live Shopify catalog sync — accurate inventory and pricing",
  "Multilingual — responds in the shopper's language",
  "Always on — no human agent needed",
];

function priceLabel(pricing: ContextData["pricing"]): string | null {
  if (!pricing) return null;
  const sym = pricing.currency === "USD" ? "$" : `${pricing.currency} `;
  const period = pricing.interval === "annual" ? "yr" : "mo";
  return `${sym}${pricing.amount}/${period}`;
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function SubscriptionSkeleton() {
  return (
    <SkeletonPage title="Subscription">
      <Card>
        <BlockStack gap="400">
          <SkeletonDisplayText size="small" />
          <SkeletonBodyText lines={5} />
        </BlockStack>
      </Card>
    </SkeletonPage>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function SubscriptionPage() {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<ContextData | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      const token = await getSessionToken();
      if (ctrl.signal.aborted) return;
      if (!token) {
        setLoadError("Couldn't get a Shopify session. Please reopen from your admin.");
        setPageState("error");
        return;
      }
      try {
        const res = await fetch(`${API_URL}/v1/shopify/embedded/context`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: ctrl.signal,
        });
        if (ctrl.signal.aborted) return;
        if (!res.ok) {
          setLoadError(`Could not load subscription info (${res.status}).`);
          setPageState("error");
          return;
        }
        const data = (await res.json()) as ContextData;
        setCtx(data);
        setPageState("ready");
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        setLoadError("Network error loading subscription info.");
        setPageState("error");
      }
    })();
    return () => ctrl.abort();
  }, []);

  const handleSubscribe = useCallback(async () => {
    setSubscribing(true);
    setSubError(null);
    const token = await getSessionToken();
    if (!token) {
      setSubError("Couldn't get a Shopify session. Please reopen from your admin.");
      setSubscribing(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/v1/shopify/embedded/billing/subscribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => ({}))) as { confirmationUrl?: string };
      if (!res.ok || !data.confirmationUrl) {
        setSubError("Could not start checkout. Please try again.");
        setSubscribing(false);
        return;
      }
      // Break out of the iframe to Shopify's hosted billing approval page.
      (window.top ?? window).location.href = data.confirmationUrl;
    } catch {
      setSubError("Network error starting checkout.");
      setSubscribing(false);
    }
  }, []);

  // ── Render states ────────────────────────────────────────────────────────

  if (pageState === "loading") return <SubscriptionSkeleton />;

  if (pageState === "error") {
    return (
      <Page title="Subscription">
        <Banner tone="critical" title="Could not load subscription">
          <Text as="p" variant="bodyMd">{loadError}</Text>
        </Banner>
      </Page>
    );
  }

  const label = priceLabel(ctx?.pricing ?? null);

  // ── Active ───────────────────────────────────────────────────────────────

  if (ctx?.assistantActive) {
    // Link to Shopify admin billing — navigate the top frame out of the iframe.
    const manageBillingUrl = ctx.shop ? `https://${ctx.shop}/admin/settings/billing` : null;

    return (
      <Page title="Subscription">
        <BlockStack gap="500">
          <Banner tone="success" title="Commerce Assistant is active">
            <Text as="p" variant="bodyMd">
              Your catalog-grounded WhatsApp assistant is live and answering shopper questions
              around the clock.
            </Text>
          </Banner>

          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Current plan</Text>
              <Divider />
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    {ctx.pricing?.displayName ?? "Commerce Assistant"}
                  </Text>
                  {label && (
                    <Text as="p" variant="bodySm" tone="subdued">{label}</Text>
                  )}
                </BlockStack>
                <Badge tone="success">Active</Badge>
              </InlineStack>

              {manageBillingUrl && (
                <>
                  <Divider />
                  <Box>
                    <Button
                      onClick={() => { (window.top ?? window).location.href = manageBillingUrl; }}
                      variant="plain"
                    >
                      Manage billing in Shopify admin
                    </Button>
                  </Box>
                </>
              )}
            </BlockStack>
          </Card>
        </BlockStack>
      </Page>
    );
  }

  // ── Inactive — show upgrade card ─────────────────────────────────────────

  return (
    <Page title="Subscription">
      <Card>
        <BlockStack gap="500">
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">Commerce Assistant</Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Unlock the catalog-grounded WhatsApp assistant — it answers shopper questions
              using your real products, in their own language, 24/7.
            </Text>
          </BlockStack>

          <Divider />

          <List type="bullet">
            {FEATURES.map((f) => (
              <List.Item key={f}>
                <Text as="span" variant="bodyMd">{f}</Text>
              </List.Item>
            ))}
          </List>

          {label && (
            <Text as="p" variant="headingLg" fontWeight="bold">{label}</Text>
          )}

          <Divider />

          {subError && (
            <Banner tone="critical">
              <Text as="p" variant="bodyMd">{subError}</Text>
            </Banner>
          )}

          <Button
            onClick={handleSubscribe}
            loading={subscribing}
            variant="primary"
            size="large"
          >
            Subscribe
          </Button>

          <Text as="p" variant="bodySm" tone="subdued">
            Billed through your Shopify account. Cancel any time from Shopify admin.
          </Text>
        </BlockStack>
      </Card>
    </Page>
  );
}
