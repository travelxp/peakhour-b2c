"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Page,
  Card,
  BlockStack,
  InlineStack,
  InlineGrid,
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
import {
  CheckCircleIcon,
  MagicIcon,
  ProductIcon,
  ChatIcon,
  GlobeIcon,
  ChartVerticalIcon,
  ShieldCheckMarkIcon,
  LanguageIcon,
  StarIcon,
} from "@shopify/polaris-icons";
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

// Meaningful icon per commerce feature key — replaces the generic checkmarks
// for stronger scannability + visual hierarchy (#1). Unknown keys fall back to
// a checkmark.
const FEATURE_ICONS: Record<string, typeof CheckCircleIcon> = {
  "commerce.assistant": MagicIcon,
  "commerce.in_app_assistant": MagicIcon,
  "commerce.catalog_sync": ProductIcon,
  "commerce.whatsapp": ChatIcon,
  "commerce.multilingual": LanguageIcon,
  "commerce.insights_network": GlobeIcon,
};
function featureIcon(key: string): typeof CheckCircleIcon {
  return FEATURE_ICONS[key] ?? CheckCircleIcon;
}

/** One feature line — fixed-width icon gutter, top-aligned so the icon sits on
 *  the first line even when the label wraps. Shared by both plan cards so the
 *  icon column is identical across cards and every feature shows in full. */
function FeatureRow({
  icon,
  label,
  tone = "success",
}: {
  icon: typeof CheckCircleIcon;
  label: string;
  tone?: "success" | "subdued";
}) {
  return (
    <InlineStack gap="200" blockAlign="start" wrap={false}>
      <span style={{ flex: "0 0 auto", display: "inline-flex", paddingTop: 1 }}>
        <Icon source={icon} tone={tone} />
      </span>
      <Text as="span" variant="bodySm">
        {label}
      </Text>
    </InlineStack>
  );
}

// The free experience IS the Insights Network community — its worth is the
// community/insights, not the raw cfg feature keys, so these value props are
// curated presentation copy (icon + label), not CMS-sourced.
const INSIGHTS_EXPERIENCE_FEATURES: Array<{ icon: typeof CheckCircleIcon; label: string }> = [
  { icon: ChartVerticalIcon, label: "Industry insights & growth trends" },
  { icon: GlobeIcon, label: "Community benchmarks — see how you compare" },
  { icon: MagicIcon, label: "AI-powered recommendations" },
  { icon: StarIcon, label: "Early access to new features" },
  { icon: ShieldCheckMarkIcon, label: "Privacy first — your identity stays yours" },
];

// Shown on the Commerce Assistant card when the pricing endpoint returned no
// tiers (network blip) — keeps the card meaningful (mirrors the cfg_plans
// commerce tier feature set).
const DEFAULT_COMMERCE_FEATURES = [
  "commerce.assistant",
  "commerce.catalog_sync",
  "commerce.whatsapp",
  "commerce.multilingual",
];

/** Annual savings computed from the tier's monthly/yearly prices (integer
 *  cents) — replaces the hardcoded "2 months free" claim. Returns null when
 *  there's no real annual discount to show. */
function annualSavings(t?: PlanTier): { monthsFree: number; pct: number } | null {
  const m = t?.pricing?.monthly;
  const y = t?.pricing?.yearly;
  if (!m || !y || y <= 0) return null;
  const fullYear = m * 12;
  if (y >= fullYear) return null;
  return {
    monthsFree: Math.round((fullYear - y) / m),
    pct: Math.round(((fullYear - y) / fullYear) * 100),
  };
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
  // 10-plan catalog: the paid Commerce tier is commerce_assistant.paid
  // (was the retired commerce_assistant.commerce).
  const commerceTier = tiers.find((t) => t.key === "commerce_assistant.paid");
  const savings = annualSavings(commerceTier);

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

  // ── Inactive — experience-first comparison (#4) ──────────────────────────
  // Two intentional entry points: the free Insights Network community vs the
  // paid Commerce Assistant — not "free vs locked features". The free card is
  // curated community value props; the paid card is CMS-driven (price/trial +
  // feature keys), falling back to the default feature set if tiers failed.

  const paidFeatures =
    commerceTier && commerceTier.features.length > 0
      ? commerceTier.features
      : DEFAULT_COMMERCE_FEATURES;

  return (
    <Page title="Plans">
      <BlockStack gap="600">
        {/* Experience-first header (#4) */}
        <BlockStack gap="200">
          <Text as="h2" variant="headingLg">Choose your Peakhour experience</Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            Start with free growth intelligence, or unlock AI-powered commerce workflows.
          </Text>
        </BlockStack>

        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          {/* ── Experience 1 — Insights Network (free, standalone value) ── */}
          <div className="ph-hover-lift ph-plan-card">
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <InlineStack align="space-between" blockAlign="center" wrap={false}>
                    <Text as="h3" variant="headingMd">Insights Network</Text>
                    <Badge tone="success">Privacy First</Badge>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Stay informed — trends, benchmarks, recommendations, and early releases.
                  </Text>
                </BlockStack>

                <Text as="p" variant="heading2xl" fontWeight="bold">Free</Text>

                {/* #3 — never "Current plan"; positive community framing whether
                    or not Commerce is connected. */}
                <InlineStack gap="150" blockAlign="center" wrap={false}>
                  <Icon source={CheckCircleIcon} tone="success" />
                  <Text as="span" variant="bodySm" tone="success" fontWeight="medium">
                    Community Access Active
                  </Text>
                </InlineStack>

                <Divider />

                <BlockStack gap="300">
                  {INSIGHTS_EXPERIENCE_FEATURES.map((f) => (
                    <FeatureRow key={f.label} icon={f.icon} label={f.label} tone="subdued" />
                  ))}
                </BlockStack>

                <Button url="/shopify/embedded/pin" fullWidth size="large" variant="secondary">
                  Start Free
                </Button>
              </BlockStack>
            </Card>
          </div>

          {/* ── Experience 2 — Commerce Assistant (paid) ── */}
          <div className="ph-hover-lift ph-plan-card">
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <InlineStack align="space-between" blockAlign="center" wrap={false}>
                    <Text as="h3" variant="headingMd">Commerce Assistant</Text>
                    <Badge tone="success">Most Popular</Badge>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Connect your catalog and activate AI-powered commerce workflows.
                  </Text>
                </BlockStack>

                {label && (
                  <Text as="p" variant="heading2xl" fontWeight="bold">{label}</Text>
                )}

                {hasAnnual && (
                  <ButtonGroup variant="segmented">
                    <Button pressed={billingInterval === "monthly"} onClick={() => setBillingInterval("monthly")}>
                      Monthly
                    </Button>
                    <Button pressed={billingInterval === "annual"} onClick={() => setBillingInterval("annual")}>
                      {savings
                        ? `Annual — ${savings.monthsFree > 0 ? `${savings.monthsFree} months free` : `save ${savings.pct}%`}`
                        : "Annual"}
                    </Button>
                  </ButtonGroup>
                )}

                {trialDays > 0 && (
                  <Text as="p" variant="bodySm" tone="subdued">
                    {trialDays}-day free trial — billing starts when the trial ends.
                  </Text>
                )}

                <Divider />

                <BlockStack gap="300">
                  {paidFeatures.map((f) => (
                    <FeatureRow key={f} icon={featureIcon(f)} label={featureLabel(f)} />
                  ))}
                </BlockStack>

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
                  fullWidth
                >
                  {trialDays > 0 ? "Start Free Trial" : "Subscribe"}
                </Button>
              </BlockStack>
            </Card>
          </div>
        </InlineGrid>

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
