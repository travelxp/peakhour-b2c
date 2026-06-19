"use client";

import { useCallback, useEffect, useState } from "react";
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
  Icon,
  List,
  SkeletonPage,
  SkeletonBodyText,
  SkeletonDisplayText,
} from "@shopify/polaris";
import { ShieldCheckMarkIcon } from "@shopify/polaris-icons";
import { getSessionToken } from "../_lib/session";
import { CommerceDisconnected } from "../_components/commerce-disconnected";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * Peakhour Insights Network (PIN) — dedicated nav surface.
 *
 * Product rule (Prashant, 2026-06-12): consent is CAPTURED first-time in
 * onboarding (the connect wizard's "Insights Network" step); this page is
 * the standing home for it afterwards — members see the network, everyone
 * else gets the consent ask with a proper nudge. Settings no longer hosts
 * the membership card.
 *
 * Consent posture: affirmative-only (no pre-ticked anything), withdraw is
 * always available to members — App Review-friendly.
 */

interface PinState {
  consentStatus?: { pin_contribution?: "opted_in" | "revoked" };
}

// Truthful-today framing (matches the wizard): benchmarks ship to members
// FIRST as they roll out — never claimed as visible now. The Insights Network
// is positioned as a valuable free destination, not a Commerce setup blocker.
const INSIGHTS_BENEFITS = [
  "Industry insights and growth trends for stores like yours",
  "Community benchmarks — see how you compare, anonymously",
  "AI-powered recommendations as the network learns",
  "Early access to new features",
  "Only anonymized cohort signals are shared — never products, customers, or revenue",
];

/** What members will see appear on this page as the network rolls out —
 *  honest placeholders, never fake data. */
const COMING_INSIGHTS = [
  "How your catalog size and pricing spread compare with stores in your country and sector",
  "What shoppers ask assistants in your category — the questions your store should answer",
  "Seasonal demand signals across the network, ahead of your own data showing them",
];

type Membership = "loading" | "member" | "nonmember" | "unknown" | "notlinked";

/**
 * Privacy First by Design — the standing trust section. Privacy is the
 * Insights Network's key differentiator, so it's surfaced on the page for both
 * members and prospective members (not just buried in benefit bullets).
 */
function PrivacyFirstCard() {
  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack gap="200" blockAlign="center">
          <Icon source={ShieldCheckMarkIcon} tone="success" />
          <Text as="h2" variant="headingMd">
            Privacy First by Design
          </Text>
          <Badge tone="success">Privacy First</Badge>
        </InlineStack>
        <Divider />
        <Text as="p" variant="bodyMd" tone="subdued">
          Peakhour does not track personal identities. Your data remains yours —
          you choose what to connect, what to share, and when to upgrade.
        </Text>
        <List type="bullet">
          <List.Item>
            <Text as="span" variant="bodyMd">No personal identity tracking</Text>
          </List.Item>
          <List.Item>
            <Text as="span" variant="bodyMd">No invasive profiling</Text>
          </List.Item>
          <List.Item>
            <Text as="span" variant="bodyMd">No selling of your data</Text>
          </List.Item>
          <List.Item>
            <Text as="span" variant="bodyMd">
              Only anonymized cohort signals are shared — never products,
              customers, or revenue
            </Text>
          </List.Item>
        </List>
      </BlockStack>
    </Card>
  );
}

function PinSkeleton() {
  return (
    <SkeletonPage title="Insights Network">
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
      </BlockStack>
    </SkeletonPage>
  );
}

/** Shop domain from the App Bridge session token's `dest` claim
 *  (`https://{shop}.myshopify.com`). Display/navigation use only — never
 *  trusted server-side (the api verifies the token signature itself). */
function shopFromSessionToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as { dest?: string };
    const host = payload.dest ? new URL(payload.dest).hostname : "";
    return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

export default function PinPage() {
  const [membership, setMembership] = useState<Membership>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shop, setShop] = useState<string | null>(null);
  // Bumped by the retry button — re-runs the status load (sibling-page
  // pattern: inline IIFE + cancellation flag keeps the react-compiler
  // lint happy and discards late results after unmount).
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getSessionToken();
      if (cancelled) return;
      if (!token) {
        setMembership("unknown");
        setError("Couldn't get a Shopify session. Please reopen Peakhour from your Shopify admin.");
        return;
      }
      setShop(shopFromSessionToken(token));
      try {
        const res = await fetch(`${API_URL}/v1/shopify/embedded/pin/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          // 404 = store not linked to a Peakhour account; 400 = store row
          // inactive — retrying can't fix either, so route to the connect
          // story instead of a dead-end retry loop. Other failures (401,
          // 5xx, blips) keep the retry CTA.
          setMembership(res.status === 404 || res.status === 400 ? "notlinked" : "unknown");
          return;
        }
        const data = (await res.json()) as { pin?: PinState | null };
        if (cancelled) return;
        setMembership(
          data.pin?.consentStatus?.pin_contribution === "opted_in" ? "member" : "nonmember",
        );
      } catch {
        if (!cancelled) setMembership("unknown");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [retryKey]);

  const toggle = useCallback(async (join: boolean) => {
    setBusy(true);
    setError(null);
    const token = await getSessionToken();
    if (!token) {
      setError("Couldn't get a Shopify session. Please reopen from your admin.");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/v1/shopify/embedded/pin/consent`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: join ? "opt_in" : "withdraw" }),
      });
      if (!res.ok) {
        setError("Could not update your Insights Network membership. Please try again.");
      } else {
        setMembership(join ? "member" : "nonmember");
      }
    } catch {
      setError("Network error updating membership.");
    }
    setBusy(false);
  }, []);

  if (membership === "loading") return <PinSkeleton />;

  return (
    <Page
      title="Insights Network"
      subtitle="Smart insights. Zero personal tracking. Your identity stays yours."
    >
      <BlockStack gap="500">
        {error && (
          <Banner tone="critical">
            <Text as="p" variant="bodyMd">{error}</Text>
          </Banner>
        )}

        {membership === "member" && (
          <>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Your membership</Text>
                  <Badge tone="success">Member</Badge>
                </InlineStack>
                <Divider />
                <Text as="p" variant="bodyMd" tone="subdued">
                  Your store contributes anonymized cohort signals — and members get
                  benchmarks and network insights first as they roll out. Only country,
                  industry, size, and platform-level aggregates are shared — never
                  products, customers, or revenue.
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Network insights</Text>
                  <Badge tone="attention">Rolling out</Badge>
                </InlineStack>
                <Divider />
                <Text as="p" variant="bodyMd" tone="subdued">
                  Insights appear here as the network reaches critical mass — members
                  see them first. Coming up:
                </Text>
                <List type="bullet">
                  {COMING_INSIGHTS.map((b) => (
                    <List.Item key={b}>
                      <Text as="span" variant="bodyMd">{b}</Text>
                    </List.Item>
                  ))}
                </List>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Leave the network</Text>
                <Divider />
                <Text as="p" variant="bodyMd" tone="subdued">
                  You can withdraw at any time — your store stops contributing
                  signals immediately and loses member-first access to insights.
                </Text>
                <Box>
                  <Button onClick={() => toggle(false)} loading={busy} variant="plain" tone="critical">
                    Leave the network
                  </Button>
                </Box>
              </BlockStack>
            </Card>
          </>
        )}

        {membership === "nonmember" && (
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Join the Peakhour Insights Network</Text>
              <Divider />
              <Text as="p" variant="bodyMd" tone="subdued">
                A free community for founders and operators growing smarter with AI. Smart insights,
                zero personal tracking — your identity stays yours.
              </Text>
              <List type="bullet">
                {INSIGHTS_BENEFITS.map((b) => (
                  <List.Item key={b}>
                    <Text as="span" variant="bodyMd">{b}</Text>
                  </List.Item>
                ))}
              </List>
              <InlineStack gap="300" blockAlign="center">
                <Button onClick={() => toggle(true)} loading={busy} variant="primary">
                  Join Free Community Now
                </Button>
                <Button url="/shopify/embedded/subscription" variant="tertiary">
                  Connect Commerce Later
                </Button>
              </InlineStack>
              <Text as="span" variant="bodySm" tone="subdued">
                Opt-in only — you can leave at any time.
              </Text>
            </BlockStack>
          </Card>
        )}

        {/* Standing trust section — privacy is the network's differentiator,
            shown to members and prospective members alike. */}
        {(membership === "member" || membership === "nonmember") && <PrivacyFirstCard />}

        {membership === "notlinked" && (
          <CommerceDisconnected
            shop={shop}
            withPage={false}
            showInsightsNetworkLink={false}
          />
        )}

        {membership === "unknown" && (
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Peakhour Insights Network</Text>
              <Divider />
              <Text as="p" variant="bodyMd" tone="subdued">
                We couldn&apos;t load your membership status.
              </Text>
              <Box>
                <Button
                  onClick={() => {
                    setMembership("loading");
                    setError(null);
                    setRetryKey((k) => k + 1);
                  }}
                >
                  Try again
                </Button>
              </Box>
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
