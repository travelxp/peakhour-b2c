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
  SkeletonPage,
  SkeletonBodyText,
  SkeletonDisplayText,
  EmptyState,
  Divider,
  Box,
  InlineGrid,
} from "@shopify/polaris";
import { getSessionToken } from "./_lib/session";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

interface EmbeddedContext {
  connected: boolean;
  shop: string;
  orgId?: string;
  businessId?: string;
  storeName?: string | null;
  currency?: string | null;
  productsSyncedAt?: string | null;
  connectionStatus?: string | null;
  assistantActive?: boolean;
  productsCount?: number;
  pricing?: {
    displayName: string;
    amount: string;
    currency: string;
    interval: "monthly" | "annual";
    trialDays?: number;
  } | null;
}

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; ctx: EmbeddedContext };

// ── Helpers ────────────────────────────────────────────────────────────────

function connectionBadge(status: string | null | undefined) {
  if (!status) return <Badge tone="attention">Unknown</Badge>;
  if (status === "active") return <Badge tone="success">Active</Badge>;
  if (status === "disconnected") return <Badge tone="critical">Disconnected</Badge>;
  if (status === "pending") return <Badge tone="attention">Pending</Badge>;
  return <Badge>{status}</Badge>;
}

function formatSyncTime(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── Skeleton loading state ─────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <SkeletonPage title="Peakhour Commerce">
      <BlockStack gap="500">
        <Card>
          <BlockStack gap="400">
            <SkeletonDisplayText size="small" />
            <SkeletonBodyText lines={3} />
          </BlockStack>
        </Card>
        <Card>
          <BlockStack gap="400">
            <SkeletonDisplayText size="small" />
            <SkeletonBodyText lines={2} />
          </BlockStack>
        </Card>
        <Card>
          <BlockStack gap="400">
            <SkeletonDisplayText size="small" />
            <SkeletonBodyText lines={2} />
          </BlockStack>
        </Card>
      </BlockStack>
    </SkeletonPage>
  );
}

// ── Connected home ─────────────────────────────────────────────────────────

interface ConnectedHomeProps {
  ctx: EmbeddedContext;
  onSync: () => void;
  syncing: boolean;
  syncError: string | null;
  onSubscribe: () => void;
  subscribing: boolean;
  subError: string | null;
}

function ConnectedHome({ ctx, onSync, syncing, syncError, onSubscribe, subscribing, subError }: ConnectedHomeProps) {
  const storeName = ctx.storeName || ctx.shop;
  const syncLabel = ctx.productsSyncedAt ? "Sync now" : "Sync catalog";

  return (
    <Page
      title="Peakhour Commerce"
      subtitle={storeName}
    >
      <BlockStack gap="500">
        {/* ── Card 1 — Store Health ───────────────────────────────────── */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Store health
            </Text>
            <Divider />
            <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">
                  Store
                </Text>
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  {storeName}
                </Text>
              </BlockStack>
              {ctx.currency && (
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Currency
                  </Text>
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    {ctx.currency}
                  </Text>
                </BlockStack>
              )}
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">
                  Connection
                </Text>
                <Box>{connectionBadge(ctx.connectionStatus)}</Box>
              </BlockStack>
            </InlineGrid>
          </BlockStack>
        </Card>

        {/* ── Card 2 — Sync Status ────────────────────────────────────── */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">
                Catalog sync
              </Text>
              <Button
                onClick={onSync}
                loading={syncing}
                disabled={syncing}
                size="slim"
                variant="secondary"
              >
                {syncLabel}
              </Button>
            </InlineStack>
            <Divider />
            <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">
                  Products synced
                </Text>
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  {ctx.productsCount != null ? ctx.productsCount.toLocaleString() : "—"}
                </Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">
                  Last synced
                </Text>
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  {formatSyncTime(ctx.productsSyncedAt)}
                </Text>
              </BlockStack>
            </InlineGrid>
            {syncError && (
              <Banner tone="critical">
                <Text as="p" variant="bodyMd">
                  {syncError}
                </Text>
              </Banner>
            )}
            {syncing && (
              <Banner tone="info">
                <Text as="p" variant="bodyMd">
                  Sync started — this may take a minute. Refresh to see updated counts.
                </Text>
              </Banner>
            )}
          </BlockStack>
        </Card>

        {/* ── Card 3 — Commerce Assistant ─────────────────────────────── */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Commerce assistant
            </Text>
            <Divider />
            {ctx.assistantActive ? (
              <BlockStack gap="300">
                <InlineStack gap="200" blockAlign="center">
                  <Badge tone="success">Active</Badge>
                  <Text as="p" variant="bodyMd">
                    Your catalog-grounded WhatsApp assistant is live.
                  </Text>
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Manage voice settings, preview conversations, and review analytics from your
                  Peakhour dashboard.
                </Text>
                <Box>
                  {/* external → new tab, which naturally escapes the admin iframe */}
                  <Button url="/dashboard" external>
                    Open Peakhour Dashboard
                  </Button>
                </Box>
              </BlockStack>
            ) : (
              <BlockStack gap="400">
                <Text as="p" variant="bodyMd" tone="subdued">
                  Unlock the catalog-grounded WhatsApp assistant — it answers shopper questions
                  using your real products, in their own language, around the clock.
                </Text>
                {subError && (
                  <Banner tone="critical">
                    <Text as="p" variant="bodyMd">
                      {subError}
                    </Text>
                  </Banner>
                )}
                <InlineStack gap="300" blockAlign="center">
                  <Button
                    onClick={onSubscribe}
                    loading={subscribing}
                    disabled={subscribing}
                    variant="primary"
                  >
                    {ctx.pricing
                      ? (ctx.pricing.trialDays ?? 0) > 0
                        ? `Start ${ctx.pricing.trialDays}-day free trial — then ${ctx.pricing.currency === "USD" ? "$" : ctx.pricing.currency + " "}${ctx.pricing.amount}/${ctx.pricing.interval === "annual" ? "yr" : "mo"}`
                        : `Subscribe — ${ctx.pricing.currency === "USD" ? "$" : ctx.pricing.currency + " "}${ctx.pricing.amount}/${ctx.pricing.interval === "annual" ? "yr" : "mo"}`
                      : "Subscribe to Commerce"}
                  </Button>
                  <Button url="/dashboard" variant="plain" external>
                    Open Peakhour Dashboard
                  </Button>
                </InlineStack>
              </BlockStack>
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

// ── Root component ─────────────────────────────────────────────────────────

export default function ShopifyEmbeddedHome() {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getSessionToken();
      if (cancelled) return;
      if (!token) {
        setState({ status: "error", message: "Couldn't get a Shopify session. Please open Peakhour from your Shopify admin." });
        return;
      }
      try {
        const res = await fetch(`${API_URL}/v1/shopify/embedded/context`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          setState({ status: "error", message: `Could not load your store (${res.status}).` });
          return;
        }
        const ctx = (await res.json()) as EmbeddedContext;
        if (!cancelled) setState({ status: "ready", ctx });
      } catch {
        if (!cancelled) setState({ status: "error", message: "Network error contacting Peakhour." });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    const token = await getSessionToken();
    if (!token) {
      setSyncError("Couldn't get a Shopify session. Please reopen from your admin.");
      setSyncing(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/v1/shopify/embedded/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSyncError(data.error ?? `Sync failed (${res.status}). Please try again.`);
        setSyncing(false);
      } else {
        // Fire-and-forget queued — keep the "Sync started" banner for a few seconds
        // so the merchant sees feedback, then clear (they can refresh for updated counts).
        setTimeout(() => setSyncing(false), 5000);
      }
    } catch {
      setSyncError("Network error triggering sync.");
      setSyncing(false);
    }
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
      // Break out of the Shopify admin iframe to the hosted billing page.
      (window.top ?? window).location.href = data.confirmationUrl;
    } catch {
      setSubError("Network error starting checkout.");
      setSubscribing(false);
    }
  }, []);

  if (state.status === "loading") return <LoadingSkeleton />;

  if (state.status === "error") {
    return (
      <Page title="Peakhour Commerce">
        <Banner tone="critical" title="Could not load your store">
          <Text as="p" variant="bodyMd">
            {state.message}
          </Text>
        </Banner>
      </Page>
    );
  }

  if (!state.ctx.connected) {
    const shop = state.ctx.shop;
    const connectUrl = shop
      ? `/shopify/connect?shop=${encodeURIComponent(shop)}`
      : "/shopify/connect";
    return (
      <Page title="Peakhour Commerce">
        <EmptyState
          heading="Link your Peakhour account"
          action={{
            content: "Set up Peakhour Commerce",
            // Navigate the top-level window — relative URLs inside an admin
            // iframe would only navigate the iframe itself.
            onAction: () => { (window.top ?? window).location.href = connectUrl; },
          }}
          image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
        >
          <Text as="p" variant="bodyMd">
            {shop ? `${shop} isn't` : "This store isn't"} linked to a Peakhour account yet.
            Finish setup to connect your catalog and enable the AI commerce assistant.
          </Text>
        </EmptyState>
      </Page>
    );
  }

  return (
    <ConnectedHome
      ctx={state.ctx}
      onSync={handleSync}
      syncing={syncing}
      syncError={syncError}
      onSubscribe={handleSubscribe}
      subscribing={subscribing}
      subError={subError}
    />
  );
}
