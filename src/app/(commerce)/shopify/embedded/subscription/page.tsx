"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Page,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  ButtonGroup,
  Banner,
  Badge,
  Divider,
  Icon,
  Modal,
  SkeletonPage,
  SkeletonBodyText,
  SkeletonDisplayText,
} from "@shopify/polaris";
import { CheckCircleIcon } from "@shopify/polaris-icons";
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
    trialDays?: number;
    annual?: { amount: string; currency: string } | null;
  } | null;
}

interface PlanTier {
  key: string;
  name: string;
  tagline?: string;
  features: string[];
  highlightAsRecommended: boolean;
  pricing: {
    monthly: number;
    yearly: number;
    trialDays: number;
    displayPrefix?: string;
  };
}

type PageState = "loading" | "error" | "ready";

// ── Helpers ────────────────────────────────────────────────────────────────

// Human-readable labels for cfg_feature keys.
const FEATURE_LABELS: Record<string, string> = {
  "commerce.assistant": "Live AI commerce assistant",
  "commerce.catalog_sync": "Automatic catalog sync",
  "commerce.whatsapp": "WhatsApp shopping channel",
  "commerce.in_app_assistant": "In-app product assistant",
  "commerce.multilingual": "Multilingual replies (inc. Hinglish)",
  "commerce.insights_network": "Insights Network access",
};

function featureLabel(key: string): string {
  return FEATURE_LABELS[key] ?? key;
}

function priceLabel(pricing: ContextData["pricing"], interval: "monthly" | "annual"): string | null {
  if (!pricing) return null;
  if (interval === "annual" && pricing.annual) {
    const sym = pricing.annual.currency === "USD" ? "$" : `${pricing.annual.currency} `;
    return `${sym}${pricing.annual.amount}/yr`;
  }
  const sym = pricing.currency === "USD" ? "$" : `${pricing.currency} `;
  return `${sym}${pricing.amount}/${pricing.interval === "annual" ? "yr" : "mo"}`;
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function SubscriptionSkeleton() {
  return (
    <SkeletonPage title="Plans">
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="400">
            <SkeletonDisplayText size="small" />
            <SkeletonBodyText lines={4} />
          </BlockStack>
        </Card>
        <Card>
          <BlockStack gap="400">
            <SkeletonDisplayText size="small" />
            <SkeletonBodyText lines={6} />
          </BlockStack>
        </Card>
      </BlockStack>
    </SkeletonPage>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function SubscriptionPage() {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<ContextData | null>(null);
  const [tiers, setTiers] = useState<PlanTier[]>([]);
  const [subscribing, setSubscribing] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleCancel = useCallback(async () => {
    setCancelling(true);
    setCancelError(null);
    const token = await getSessionToken();
    if (!token) {
      setCancelError("Couldn't get a Shopify session. Please reopen from your admin.");
      setCancelling(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/v1/shopify/embedded/billing/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => ({}))) as { cancelled?: boolean; active?: boolean };
      if (!res.ok || !data.cancelled) {
        setCancelError("Could not cancel your subscription. Please try again.");
        setCancelling(false);
        return;
      }
      setCtx((prev) => (prev ? { ...prev, assistantActive: data.active === true } : prev));
      setCancelOpen(false);
      setCancelling(false);
    } catch {
      setCancelError("Network error cancelling.");
      setCancelling(false);
    }
  }, []);

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

      // Fetch context + plan tiers in parallel.
      const [contextRes, pricingRes] = await Promise.all([
        fetch(`${API_URL}/v1/shopify/embedded/context`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: ctrl.signal,
        }).catch(() => null),
        fetch(`${API_URL}/v1/platform/pricing?country=DEFAULT`).catch(() => null),
      ]);

      if (ctrl.signal.aborted) return;

      if (!contextRes || !contextRes.ok) {
        setLoadError(`Could not load subscription info (${contextRes?.status ?? "network error"}).`);
        setPageState("error");
        return;
      }

      const data = (await contextRes.json()) as ContextData;
      setCtx(data);

      // Extract commerce_assistant tiers from the pricing response (best-effort).
      if (pricingRes?.ok) {
        try {
          const pj = (await pricingRes.json()) as {
            ok?: boolean;
            data?: {
              products?: Array<{
                key: string;
                tiers?: PlanTier[];
              }>;
            };
          };
          const commerceProduct = pj.data?.products?.find((p) => p.key === "commerce_assistant");
          if (commerceProduct?.tiers) setTiers(commerceProduct.tiers);
        } catch {
          // Non-fatal — tiers stay empty, UI falls back gracefully.
        }
      }

      setPageState("ready");
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
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ interval: billingInterval }),
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
  }, [billingInterval]);

  // ── Render states ────────────────────────────────────────────────────────

  if (pageState === "loading") return <SubscriptionSkeleton />;

  if (pageState === "error") {
    return (
      <Page title="Plans">
        <Banner tone="critical" title="Could not load subscription">
          <Text as="p" variant="bodyMd">{loadError}</Text>
        </Banner>
      </Page>
    );
  }

  const label = priceLabel(ctx?.pricing ?? null, billingInterval);
  const hasAnnual = !!ctx?.pricing?.annual;
  // Extract once so ternary branches can reference it without non-null assertions.
  const trialDays = ctx?.pricing?.trialDays ?? 0;
  const lensTier = tiers.find((t) => t.key === "commerce_assistant.lens");
  const commerceTier = tiers.find((t) => t.key === "commerce_assistant.commerce");

  // ── Active ───────────────────────────────────────────────────────────────

  if (ctx?.assistantActive) {
    const manageBillingUrl = ctx.shop ? `https://${ctx.shop}/admin/settings/billing` : null;

    return (
      <Page title="Plans">
        <BlockStack gap="500">
          <Banner tone="success" title="Peakhour Commerce is active">
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
                    {ctx.pricing?.displayName ?? "Peakhour Commerce"}
                  </Text>
                  {label && (
                    <Text as="p" variant="bodySm" tone="subdued">{label}</Text>
                  )}
                </BlockStack>
                <Badge tone="success">Active</Badge>
              </InlineStack>

              {commerceTier && commerceTier.features.length > 0 && (
                <>
                  <Divider />
                  <BlockStack gap="200">
                    {commerceTier.features.map((f) => (
                      <InlineStack key={f} gap="200" blockAlign="center">
                        <Icon source={CheckCircleIcon} tone="success" />
                        <Text as="span" variant="bodySm">{featureLabel(f)}</Text>
                      </InlineStack>
                    ))}
                  </BlockStack>
                </>
              )}

              <Divider />
              {cancelError && (
                <Banner tone="critical">
                  <Text as="p" variant="bodyMd">{cancelError}</Text>
                </Banner>
              )}
              <InlineStack gap="400" blockAlign="center">
                {manageBillingUrl && (
                  <Button
                    onClick={() => { (window.top ?? window).location.href = manageBillingUrl; }}
                    variant="plain"
                  >
                    View invoices in Shopify admin
                  </Button>
                )}
                {/* Review req 1.2.3: merchants must be able to cancel in-app
                    without uninstalling. */}
                <Button
                  onClick={() => setCancelOpen(true)}
                  variant="plain"
                  tone="critical"
                >
                  Cancel subscription
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </BlockStack>

        <Modal
          open={cancelOpen}
          onClose={() => { if (!cancelling) setCancelOpen(false); }}
          title="Cancel your subscription?"
          primaryAction={{
            content: "Cancel subscription",
            destructive: true,
            loading: cancelling,
            onAction: handleCancel,
          }}
          secondaryActions={[
            { content: "Keep it", disabled: cancelling, onAction: () => setCancelOpen(false) },
          ]}
        >
          <Modal.Section>
            <Text as="p" variant="bodyMd">
              This cancels the Commerce Assistant right away — the live WhatsApp assistant
              goes offline. Your catalog stays synced and the rest of the app keeps working;
              you can resubscribe anytime from this page.
            </Text>
          </Modal.Section>
        </Modal>
      </Page>
    );
  }

  // ── Inactive — show tier comparison ──────────────────────────────────────

  return (
    <Page title="Plans">
      <BlockStack gap="600">
        <BlockStack gap="200">
          <Text as="h2" variant="headingLg">Commerce Assistant plans</Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            Connect your store and get started free. Upgrade to unlock the live WhatsApp
            assistant.
          </Text>
        </BlockStack>

        {/* Tier comparison cards */}
        {tiers.length > 0 ? (
          <BlockStack gap="400">
            {/* Lens — free, current */}
            {lensTier && (
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="start">
                    <BlockStack gap="100">
                      <Text as="h3" variant="headingMd">{lensTier.name}</Text>
                      {lensTier.tagline && (
                        <Text as="p" variant="bodySm" tone="subdued">{lensTier.tagline}</Text>
                      )}
                    </BlockStack>
                    <BlockStack gap="100" inlineAlign="end">
                      <Text as="p" variant="headingLg" fontWeight="bold">Free</Text>
                      <Badge>Included</Badge>
                    </BlockStack>
                  </InlineStack>
                  {lensTier.features.length > 0 && (
                    <BlockStack gap="200">
                      {lensTier.features.map((f) => (
                        <InlineStack key={f} gap="200" blockAlign="center">
                          <Icon source={CheckCircleIcon} tone="base" />
                          <Text as="span" variant="bodySm">{featureLabel(f)}</Text>
                        </InlineStack>
                      ))}
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
            )}

            {/* Peakhour Commerce — paid */}
            {commerceTier && (
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="start">
                    <BlockStack gap="100">
                      <Text as="h3" variant="headingMd">{commerceTier.name}</Text>
                      {commerceTier.tagline && (
                        <Text as="p" variant="bodySm" tone="subdued">{commerceTier.tagline}</Text>
                      )}
                    </BlockStack>
                    <BlockStack gap="100" inlineAlign="end">
                      {label ? (
                        <>
                          <Text as="p" variant="headingLg" fontWeight="bold">{label}</Text>
                          <Badge tone="info">Recommended</Badge>
                        </>
                      ) : (
                        <Badge tone="info">Recommended</Badge>
                      )}
                    </BlockStack>
                  </InlineStack>

                  {commerceTier.features.length > 0 && (
                    <BlockStack gap="200">
                      {commerceTier.features.map((f) => (
                        <InlineStack key={f} gap="200" blockAlign="center">
                          <Icon source={CheckCircleIcon} tone="success" />
                          <Text as="span" variant="bodySm">{featureLabel(f)}</Text>
                        </InlineStack>
                      ))}
                    </BlockStack>
                  )}

                  <Divider />

                  {hasAnnual && (
                    <ButtonGroup variant="segmented">
                      <Button pressed={billingInterval === "monthly"} onClick={() => setBillingInterval("monthly")}>
                        Monthly
                      </Button>
                      <Button pressed={billingInterval === "annual"} onClick={() => setBillingInterval("annual")}>
                        Annual — 2 months free
                      </Button>
                    </ButtonGroup>
                  )}

                  {trialDays > 0 && (
                    <Text as="p" variant="bodySm" tone="subdued">
                      {trialDays}-day free trial — billing starts when the trial ends.
                    </Text>
                  )}

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
                    {trialDays > 0
                      ? `Start ${trialDays}-day free trial`
                      : "Subscribe to Peakhour Commerce"}
                  </Button>
                </BlockStack>
              </Card>
            )}
          </BlockStack>
        ) : (
          /* Fallback when pricing endpoint returned no tiers (network issue) */
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Peakhour Commerce</Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Unlock the catalog-grounded WhatsApp assistant — it answers shopper questions
                using your real products, in their own language, 24/7.
              </Text>
              <Divider />
              {hasAnnual && (
                <ButtonGroup variant="segmented">
                  <Button pressed={billingInterval === "monthly"} onClick={() => setBillingInterval("monthly")}>
                    Monthly
                  </Button>
                  <Button pressed={billingInterval === "annual"} onClick={() => setBillingInterval("annual")}>
                    Annual — 2 months free
                  </Button>
                </ButtonGroup>
              )}
              {label && (
                <BlockStack gap="100">
                  <Text as="p" variant="headingLg" fontWeight="bold">{label}</Text>
                  {trialDays > 0 && (
                    <Text as="p" variant="bodyMd" tone="subdued">
                      {trialDays}-day free trial — billing starts when the trial ends.
                    </Text>
                  )}
                </BlockStack>
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
                {trialDays > 0
                  ? `Start ${trialDays}-day free trial`
                  : "Subscribe"}
              </Button>
            </BlockStack>
          </Card>
        )}

        <Text as="p" variant="bodySm" tone="subdued">
          Billed through your Shopify account. Cancel anytime right here on this page.
          WhatsApp Business messaging fees, where applicable, are billed directly by
          Meta to your WhatsApp Business Account — replies to shopper-initiated chats
          are free under Meta&apos;s current service-conversation pricing.
        </Text>
      </BlockStack>
    </Page>
  );
}
