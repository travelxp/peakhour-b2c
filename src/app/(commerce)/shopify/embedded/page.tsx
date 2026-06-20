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
  ButtonGroup,
  SkeletonPage,
  SkeletonBodyText,
  SkeletonDisplayText,
  Divider,
  Box,
  InlineGrid,
} from "@shopify/polaris";
import { getSessionToken } from "./_lib/session";
import { LensActivationHub } from "./_components/lens-activation-hub";
import { FinishSetupCard } from "./_components/finish-setup-card";
import { FadeIn } from "./_components/fade-in";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

interface EmbeddedContext {
  connected: boolean;
  status?: string;
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
    annual?: { amount: string; currency: string } | null;
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

function priceStr(currency: string, amount: string, interval: "monthly" | "annual"): string {
  const sym = currency === "USD" ? "$" : `${currency} `;
  return `${sym}${amount}/${interval === "annual" ? "yr" : "mo"}`;
}

/** Months-free / percent saved from the monthly vs annual amounts (same
 *  currency). Returns null when there's no real annual discount to surface. */
function homeAnnualSavings(p: {
  amount: string;
  currency: string;
  annual?: { amount: string; currency: string } | null;
}): { monthsFree: number; pct: number } | null {
  if (!p.annual || p.annual.currency !== p.currency) return null;
  const m = parseFloat(p.amount);
  const y = parseFloat(p.annual.amount);
  if (!Number.isFinite(m) || !Number.isFinite(y) || m <= 0 || y <= 0) return null;
  const fullYear = m * 12;
  if (y >= fullYear) return null;
  return {
    monthsFree: Math.round((fullYear - y) / m),
    pct: Math.round(((fullYear - y) / fullYear) * 100),
  };
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
  onSubscribe: (interval: "monthly" | "annual") => void;
  subscribing: boolean;
  subError: string | null;
}

function ConnectedHome({ ctx, onSync, syncing, syncError, onSubscribe, subscribing, subError }: ConnectedHomeProps) {
  const storeName = ctx.storeName || ctx.shop;
  const syncLabel = ctx.productsSyncedAt ? "Sync now" : "Sync catalog";

  // Plan-activation pricing: let the merchant pick monthly or annual right here
  // (annual was previously only choosable on the Plans page). Annual prices are
  // seeded in cfg_commerce_pricing; the toggle only shows when one exists.
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const pricing = ctx.pricing;
  const hasAnnual = !!pricing?.annual;
  const savings = pricing ? homeAnnualSavings(pricing) : null;
  const trialDays = pricing?.trialDays ?? 0;
  const shownPrice = pricing
    ? billingInterval === "annual" && pricing.annual
      ? priceStr(pricing.annual.currency, pricing.annual.amount, "annual")
      : priceStr(pricing.currency, pricing.amount, "monthly")
    : null;

  return (
    <Page
      title="Peakhour Commerce"
      subtitle={storeName}
    >
      <BlockStack gap="500">
        {/* Soft activation tail — only shows when on free Lens and not yet a
            Peakhour Insights Network member; dismissible and self-hiding (step 2 of 3). */}
        <FinishSetupCard shop={ctx.shop} />

        {/* ── Card 1 — Store Health ───────────────────────────────────── */}
        <div className="ph-hover-lift">
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
        </div>

        {/* ── Card 2 — Sync Status ────────────────────────────────────── */}
        <div className="ph-hover-lift">
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
        </div>

        {/* ── Card 3 — Commerce Assistant ─────────────────────────────── */}
        <div className="ph-hover-lift">
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
                {hasAnnual && (
                  <ButtonGroup variant="segmented">
                    <Button
                      pressed={billingInterval === "monthly"}
                      onClick={() => setBillingInterval("monthly")}
                    >
                      Monthly
                    </Button>
                    <Button
                      pressed={billingInterval === "annual"}
                      onClick={() => setBillingInterval("annual")}
                    >
                      {savings
                        ? savings.monthsFree > 0
                          ? `Annual — ${savings.monthsFree} months free`
                          : `Annual — save ${savings.pct}%`
                        : "Annual"}
                    </Button>
                  </ButtonGroup>
                )}
                <InlineStack gap="300" blockAlign="center">
                  <Button
                    onClick={() => onSubscribe(billingInterval)}
                    loading={subscribing}
                    disabled={subscribing}
                    variant="primary"
                  >
                    {shownPrice
                      ? trialDays > 0
                        ? `Start ${trialDays}-day free trial — then ${shownPrice}`
                        : `Subscribe — ${shownPrice}`
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
        </div>
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

  const handleSubscribe = useCallback(async (interval: "monthly" | "annual" = "monthly") => {
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
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
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
      <FadeIn>
        <Page title="Peakhour Commerce">
          <Banner tone="critical" title="Could not load your store">
            <Text as="p" variant="bodyMd">
              {state.message}
            </Text>
          </Banner>
        </Page>
      </FadeIn>
    );
  }

  if (!state.ctx.connected) {
    return (
      <FadeIn>
        <LensActivationHub shop={state.ctx.shop} status={state.ctx.status} />
      </FadeIn>
    );
  }

  return (
    <FadeIn>
      <ConnectedHome
        ctx={state.ctx}
        onSync={handleSync}
        syncing={syncing}
        syncError={syncError}
        onSubscribe={handleSubscribe}
        subscribing={subscribing}
        subError={subError}
      />
    </FadeIn>
  );
}
