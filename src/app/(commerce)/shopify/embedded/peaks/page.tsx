"use client";

import { useEffect, useState } from "react";
import {
  Page,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Divider,
  Box,
  ProgressBar,
  DataTable,
  Banner,
  SkeletonPage,
  SkeletonBodyText,
  SkeletonDisplayText,
} from "@shopify/polaris";
import { getSessionToken } from "../_lib/session";
import { LensActivationHub } from "../_components/lens-activation-hub";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// ── Types (mirror /v1/shopify/embedded/peaks) ────────────────────────────────

type Balance =
  | { unlimited: true; plan: string }
  | {
      unlimited: false;
      plan: string;
      metric: string;
      hardCap: number;
      softCap: number;
      used: number;
      remaining: number;
      windowStartAt: string;
      resetAt: string;
      boostAddonKey: string | null;
    };

interface RateCardUseCase {
  useCase: string;
  label: string;
  creditMultiplier: number;
  minCreditsPerCall: number;
}

interface PeaksData {
  balance: Balance;
  rateCard: { useCases: RateCardUseCase[] };
}

type State =
  | { status: "loading" }
  | { status: "notlinked" }
  | { status: "error"; message: string }
  | { status: "ready"; data: PeaksData };

/** Shop domain from the App Bridge session token's `dest` claim — display only,
 *  used to seed the activation hub on the rare not-linked direct visit. */
function shopFromSessionToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as { dest?: string };
    const host = payload.dest ? new URL(payload.dest).hostname : "";
    return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

function formatResetDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function PeaksSkeleton() {
  return (
    <SkeletonPage title="Peaks">
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
            <SkeletonBodyText lines={6} />
          </BlockStack>
        </Card>
      </BlockStack>
    </SkeletonPage>
  );
}

function BalanceCard({ balance }: { balance: Balance }) {
  if (balance.unlimited) {
    return (
      <Card>
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center" wrap={false}>
            <Text as="h2" variant="headingMd">
              Your Peaks
            </Text>
            <Badge tone="success">Unlimited</Badge>
          </InlineStack>
          <Divider />
          <Text as="p" variant="bodyMd" tone="subdued">
            Your {balance.plan} plan includes unlimited Peaks — use AI freely.
          </Text>
        </BlockStack>
      </Card>
    );
  }

  const pct = balance.hardCap > 0 ? Math.min(100, Math.round((balance.used / balance.hardCap) * 100)) : 0;
  const atHardCap = balance.used >= balance.hardCap;
  const overSoftCap = balance.used >= balance.softCap;

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center" wrap={false}>
          <Text as="h2" variant="headingMd">
            Your Peaks
          </Text>
          <Badge tone={atHardCap ? "critical" : overSoftCap ? "warning" : "success"}>
            {`${balance.plan} plan`}
          </Badge>
        </InlineStack>
        <Divider />
        <InlineStack gap="200" blockAlign="baseline" wrap={false}>
          <Text as="p" variant="heading2xl" fontWeight="bold">
            {balance.remaining.toLocaleString()}
          </Text>
          <Text as="span" variant="bodyMd" tone="subdued">
            of {balance.hardCap.toLocaleString()} Peaks left
          </Text>
        </InlineStack>
        <ProgressBar progress={pct} tone={atHardCap ? "critical" : "primary"} size="small" />
        <Text as="p" variant="bodySm" tone="subdued">
          {balance.used.toLocaleString()} used this period · resets {formatResetDate(balance.resetAt)}
        </Text>
        {atHardCap ? (
          <Banner tone="critical">
            <Text as="p" variant="bodyMd">
              You&rsquo;ve used all your Peaks for this period. Upgrade your plan for a higher
              allowance, or wait until they reset.
            </Text>
          </Banner>
        ) : overSoftCap ? (
          <Banner tone="warning">
            <Text as="p" variant="bodyMd">
              You&rsquo;re running low on Peaks for this period.
            </Text>
          </Banner>
        ) : null}
      </BlockStack>
    </Card>
  );
}

function RateCard({ useCases }: { useCases: RateCardUseCase[] }) {
  const rows = useCases.map((u) => [
    u.label,
    u.minCreditsPerCall > 0 && u.minCreditsPerCall !== u.creditMultiplier
      ? `${u.creditMultiplier} (min ${u.minCreditsPerCall})`
      : String(u.creditMultiplier),
  ]);

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          What costs what
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          Peaks are spent each time AI does work for you. Here&rsquo;s the cost per task.
        </Text>
        <Divider />
        {rows.length > 0 ? (
          <DataTable
            columnContentTypes={["text", "numeric"]}
            headings={["Task", "Peaks per use"]}
            rows={rows}
          />
        ) : (
          <Box paddingBlock="400">
            <Text as="p" variant="bodyMd" tone="subdued">
              Pricing isn&rsquo;t available right now.
            </Text>
          </Box>
        )}
      </BlockStack>
    </Card>
  );
}

export default function PeaksPage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [shop, setShop] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getSessionToken();
      if (cancelled) return;
      if (!token) {
        setState({
          status: "error",
          message: "Couldn't get a Shopify session. Please reopen Peakhour from your Shopify admin.",
        });
        return;
      }
      setShop(shopFromSessionToken(token));
      try {
        const res = await fetch(`${API_URL}/v1/shopify/embedded/peaks`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        // 404 = store not linked, 400 = store inactive — both route to the
        // unified activation journey rather than a dead end.
        if (res.status === 404 || res.status === 400) {
          setState({ status: "notlinked" });
          return;
        }
        if (!res.ok) {
          setState({ status: "error", message: `Could not load your Peaks (${res.status}).` });
          return;
        }
        const data = (await res.json()) as PeaksData;
        if (cancelled) return;
        setState({ status: "ready", data });
      } catch {
        if (!cancelled) setState({ status: "error", message: "Network error loading your Peaks." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") return <PeaksSkeleton />;
  if (state.status === "notlinked") return <LensActivationHub shop={shop} />;

  if (state.status === "error") {
    return (
      <Page title="Peaks">
        <Banner tone="critical" title="Could not load your Peaks">
          <Text as="p" variant="bodyMd">
            {state.message}
          </Text>
        </Banner>
      </Page>
    );
  }

  return (
    <Page title="Peaks" subtitle="Your AI credits — what you have and what each task costs.">
      <BlockStack gap="500">
        <BalanceCard balance={state.data.balance} />
        <RateCard useCases={state.data.rateCard.useCases} />
      </BlockStack>
    </Page>
  );
}
