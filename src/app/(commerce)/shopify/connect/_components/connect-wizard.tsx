"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Page,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Banner,
  Spinner,
  Badge,
  Box,
  Icon,
  Divider,
  List,
} from "@shopify/polaris";
import { CheckIcon } from "@shopify/polaris-icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

type Step = "checking" | "auth-required" | "linking" | "consent" | "success" | "error";

interface MeUser {
  email: string;
  name?: string | null;
}

// ── Step indicator ─────────────────────────────────────────────────────────

const STEP_LABELS = ["Connect account", "Link store", "Insights Network", "All set"];

// Truthful-today framing: benchmarks don't render anywhere yet, so the benefit
// is member-FIRST access as they roll out — never "see them now".
const PIN_BENEFITS = [
  "Early access: benchmarks for stores like yours (country, industry, size) reach members first",
  "Help shape sharper AI recommendations as the network learns",
  "No product names, customer data, or revenue figures ever leave your store — only anonymized cohort signals",
];

function StepIndicator({ current, done }: { current: number; done: boolean }) {
  return (
    <InlineStack gap="400" align="center" blockAlign="center" wrap={false}>
      {STEP_LABELS.map((label, i) => {
        const isCompleted = done || i < current;
        const isActive = !done && i === current;
        return (
          <InlineStack key={label} gap="200" blockAlign="center" wrap={false}>
            {i > 0 && (
              <div
                style={{
                  flex: "1 1 32px",
                  height: 2,
                  background: isCompleted ? "var(--p-color-bg-fill-success)" : "var(--p-color-bg-fill-secondary)",
                  minWidth: 24,
                }}
              />
            )}
            <InlineStack gap="150" blockAlign="center" wrap={false}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: isCompleted
                    ? "var(--p-color-bg-fill-success)"
                    : isActive
                      ? "var(--p-color-bg-fill-emphasis)"
                      : "var(--p-color-bg-fill-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: isCompleted || isActive ? "white" : "var(--p-color-text-subdued)",
                }}
              >
                {isCompleted ? (
                  <Icon source={CheckIcon} />
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1 }}>{i + 1}</span>
                )}
              </div>
              <Text
                as="span"
                variant="bodySm"
                fontWeight={isActive ? "semibold" : "regular"}
                tone={isCompleted || isActive ? undefined : "subdued"}
              >
                {label}
              </Text>
            </InlineStack>
          </InlineStack>
        );
      })}
    </InlineStack>
  );
}

// ── Main wizard ────────────────────────────────────────────────────────────

interface Props {
  shop: string;
  token: string;
  /** Re-entry mode for expired/consumed link tokens: skips the token
   *  requirement and restarts OAuth via the session-authed authorize route
   *  (Shopify skips the grant screen for an already-installed app). */
  reconnect?: boolean;
}

export function ConnectWizard({ shop, token, reconnect = false }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("checking");
  const [user, setUser] = useState<MeUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [pinJoinFailed, setPinJoinFailed] = useState(false);
  // Expired/consumed link token — recoverable without reinstalling (see
  // reconnectNow), so the error UI offers a reconnect button.
  const [tokenExpired, setTokenExpired] = useState(false);
  // Which step the wizard was on when an error occurred, so the indicator
  // doesn't show later steps (incl. Insights Network) as completed.
  const [failedAt, setFailedAt] = useState(0);

  // Restart OAuth for an already-installed app — Shopify skips the grant
  // screen, the session-authed dashboard callback path links the store
  // directly (no pending-install token involved). Signed-out users go
  // through the magic-link auth first, then return here in reconnect mode.
  const reconnectNow = useCallback((hasSession: boolean) => {
    if (hasSession) {
      window.location.href = `${API_URL}/v1/integrations/shopify/authorize?shop=${encodeURIComponent(shop)}`;
    } else {
      const next = encodeURIComponent(`/shopify/connect?shop=${encodeURIComponent(shop)}&reconnect=1`);
      window.location.href = `/auth?next=${next}`;
    }
  }, [shop]);

  const linkStore = useCallback(async () => {
    setStep("linking");
    setFailedAt(1);
    try {
      const res = await fetch(`${API_URL}/v1/integrations/shopify/link`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkToken: token }),
      });
      if (res.ok) {
        setStep("consent");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        code?: string;
      };
      if (data.code === "NO_ORG" || data.code === "NO_BUSINESS" || res.status === 403) {
        setError(
          "Your Peakhour account isn't fully set up yet. " +
            "Please complete the onboarding (add a workspace and business), " +
            "then reinstall the app from the Shopify App Store.",
        );
      } else if (data.code === "TOKEN_EXPIRED" || res.status === 410) {
        setTokenExpired(true);
        setError(
          "Your store connection link has expired — no need to reinstall, just reconnect below.",
        );
      } else {
        setError(data.error ?? data.message ?? `Link failed (${res.status}). Please try again.`);
      }
      setStep("error");
    } catch {
      setError("Network error — please check your connection and try again.");
      setStep("error");
    }
  }, [token]);

  // PIN opt-in from the wizard. Consent is never a gate on onboarding — a
  // failed call advances anyway (the merchant can join later from Settings),
  // but the success screen says so instead of implying enrollment.
  const joinNetwork = useCallback(async () => {
    setJoining(true);
    try {
      const res = await fetch(`${API_URL}/v1/pin/consent`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consentType: "pin_contribution", source: "onboarding" }),
      });
      if (!res.ok) setPinJoinFailed(true);
    } catch {
      setPinJoinFailed(true);
    }
    setStep("success");
  }, []);

  // Auto-redirect to embedded surface 1.5 s after successful link
  useEffect(() => {
    if (step === "success") {
      const t = setTimeout(() => router.push("/shopify/embedded"), 1500);
      return () => clearTimeout(t);
    }
  }, [step, router]);

  useEffect(() => {
    if (!shop || (!token && !reconnect)) {
      setError(
        "Missing shop or connection token. Please reinstall Peakhour Commerce from the Shopify App Store.",
      );
      setStep("error");
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_URL}/v1/auth/me`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = (await res.json()) as { user?: MeUser };
          setUser(data.user ?? null);
          if (reconnect) {
            // Re-entry after an expired link (or post-auth return): restart
            // OAuth directly — no pending-install token involved.
            reconnectNow(true);
          } else {
            linkStore();
          }
        } else {
          setStep("auth-required");
        }
      } catch {
        setStep("auth-required");
      }
    })();
  }, [shop, token, reconnect, linkStore, reconnectNow]);

  // The auth page is a unified magic-link flow (no separate sign-up route).
  // Both "sign in" and "create account" land on the same page; the merchant
  // receives a magic link and is created if they don't exist. Reconnect mode
  // carries reconnect=1 instead of a token so the return trip restarts OAuth.
  const encodedNext = encodeURIComponent(
    reconnect
      ? `/shopify/connect?shop=${encodeURIComponent(shop)}&reconnect=1`
      : `/shopify/connect?shop=${encodeURIComponent(shop)}&token=${encodeURIComponent(token)}`,
  );
  const authUrl = `/auth?next=${encodedNext}`;

  const currentStepIndex =
    step === "checking" || step === "auth-required"
      ? 0
      : step === "error"
        ? failedAt
        : step === "linking"
          ? 1
          : step === "consent"
            ? 2
            : 3;
  const isDone = step === "success";

  return (
    <Page narrowWidth>
      <BlockStack gap="800">
        {/* ── Brand header ──────────────────────────────────────────── */}
        <BlockStack gap="300" inlineAlign="center">
          <InlineStack gap="300" blockAlign="center" align="center">
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand mark, no optimization needed */}
            <img
              src="/peakhour-icon.svg"
              alt="Peakhour"
              width={44}
              height={44}
              style={{ flexShrink: 0 }}
            />
            <Text as="h1" variant="headingXl" fontWeight="bold">
              Peakhour Commerce
            </Text>
          </InlineStack>
          {shop && (
            <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
              Connecting{" "}
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                {shop}
              </Text>
            </Text>
          )}
        </BlockStack>

        {/* ── Wizard card ───────────────────────────────────────────── */}
        <Card>
          <BlockStack gap="600">
            <StepIndicator current={currentStepIndex} done={isDone} />

            <Divider />

            {/* Step 1 — checking session */}
            {step === "checking" && (
              <BlockStack gap="400" inlineAlign="center">
                <Spinner size="large" />
                <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                  Checking your session…
                </Text>
              </BlockStack>
            )}

            {/* Step 1 — sign in required */}
            {step === "auth-required" && (
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Connect your Peakhour account
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Sign in or create a free Peakhour account to link
                    {shop ? ` ${shop}` : " your store"} and unlock catalog-grounded AI
                    marketing — WhatsApp assistant, social content, and more.
                  </Text>
                </BlockStack>

                <Button url={authUrl} variant="primary" size="large" fullWidth>
                  Continue with Peakhour
                </Button>

                {!reconnect && (
                  <InlineStack align="center">
                    <Badge tone="attention">Link expires in 60 min</Badge>
                  </InlineStack>
                )}
              </BlockStack>
            )}

            {/* Step 2 — linking */}
            {step === "linking" && (
              <BlockStack gap="400" inlineAlign="center">
                <Spinner size="large" />
                <BlockStack gap="100" inlineAlign="center">
                  <Text as="p" variant="bodyMd" alignment="center">
                    Linking{shop ? ` ${shop}` : " your store"} to Peakhour…
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                    This usually takes just a moment.
                  </Text>
                </BlockStack>
              </BlockStack>
            )}

            {/* Step 3 — Insights Network opt-in (the Lens-plan knowhow nudge) */}
            {step === "consent" && (
              <BlockStack gap="500">
                <Banner tone="success" title="Store connected!">
                  <Text as="p" variant="bodyMd">
                    {shop ? <strong>{shop}</strong> : "Your store"} is linked and your catalog is
                    syncing in the background.
                  </Text>
                </Banner>

                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Join the Peakhour Insights Network
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Stores in the network contribute anonymized commerce signals — and get
                    the network&apos;s know-how back as it grows. Included free on your Lens
                    plan.
                  </Text>
                </BlockStack>

                <List type="bullet">
                  {PIN_BENEFITS.map((b) => (
                    <List.Item key={b}>
                      <Text as="span" variant="bodyMd">{b}</Text>
                    </List.Item>
                  ))}
                </List>

                <BlockStack gap="200">
                  <Button
                    onClick={joinNetwork}
                    loading={joining}
                    variant="primary"
                    size="large"
                    fullWidth
                  >
                    Count me in
                  </Button>
                  <Button
                    onClick={() => setStep("success")}
                    disabled={joining}
                    variant="tertiary"
                    fullWidth
                  >
                    Maybe later
                  </Button>
                </BlockStack>

                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  You can join or leave anytime from Settings.
                </Text>
              </BlockStack>
            )}

            {/* Step 4 — success (auto-redirects to /shopify/embedded in 1.5 s) */}
            {step === "success" && (
              <BlockStack gap="500">
                <Banner tone="success" title="Store connected!">
                  <Text as="p" variant="bodyMd">
                    {shop ? (
                      <>
                        <strong>{shop}</strong> is now linked to your Peakhour account.
                      </>
                    ) : (
                      "Your store is now linked to your Peakhour account."
                    )}{" "}
                    Your product catalog is syncing in the background.
                  </Text>
                </Banner>

                {pinJoinFailed && (
                  <Banner tone="warning">
                    <Text as="p" variant="bodyMd">
                      We couldn&apos;t enroll you in the Insights Network just now — you can
                      join anytime from Settings.
                    </Text>
                  </Banner>
                )}

                <BlockStack gap="200" inlineAlign="center">
                  <Spinner size="small" />
                  <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                    Opening Peakhour Commerce…
                  </Text>
                </BlockStack>

                <Button url="/shopify/embedded" variant="primary" size="large" fullWidth>
                  Open Peakhour Commerce
                </Button>

                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  Day-to-day controls live right here in your Shopify admin. The full
                  Peakhour dashboard{user?.email ? ` (sign in as ${user.email})` : ""} adds
                  marketing tools, analytics, and the assistant preview —{" "}
                  <Button url="/dashboard" variant="plain" size="slim" external>
                    open dashboard
                  </Button>
                </Text>
              </BlockStack>
            )}

            {/* Error state */}
            {step === "error" && (
              <BlockStack gap="500">
                <Banner tone={tokenExpired ? "warning" : "critical"} title={tokenExpired ? "Connection link expired" : "Something went wrong"}>
                  <Text as="p" variant="bodyMd">
                    {error}
                  </Text>
                </Banner>

                {tokenExpired && shop && (
                  <Button
                    onClick={() => reconnectNow(!!user)}
                    variant="primary"
                    size="large"
                    fullWidth
                  >
                    Reconnect {shop}
                  </Button>
                )}

                <InlineStack gap="300" align="center">
                  <Button url="https://apps.shopify.com" variant="plain" external>
                    Back to Shopify App Store
                  </Button>
                </InlineStack>
              </BlockStack>
            )}
          </BlockStack>
        </Card>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <InlineStack align="center">
          <Text as="p" variant="bodySm" tone="subdued" alignment="center">
            Need help?{" "}
            <Button url="mailto:hello@peakhour.ai" variant="plain" size="slim">
              Contact support
            </Button>
          </Text>
        </InlineStack>
      </BlockStack>
    </Page>
  );
}
