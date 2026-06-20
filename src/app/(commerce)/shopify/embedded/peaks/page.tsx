"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Page,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
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
      /** Depleting one-time top-up; folded into `remaining` only when usable. */
      topUpBalance: number;
      /** Whether the top-up balance is spendable — true on a paid plan. */
      topUpUsable: boolean;
    };

interface RateCardUseCase {
  useCase: string;
  label: string;
  creditMultiplier: number;
  minCreditsPerCall: number;
}

interface PeaksPack {
  key: string;
  name: string;
  credits: number;
  amount: string;
  currency: string;
}

interface UsageByTask {
  useCase: string;
  label: string;
  peaks: number;
  calls: number;
}

interface PeaksData {
  balance: Balance;
  rateCard: { useCases: RateCardUseCase[] };
  /** Active, public top-up packs. Empty until ops activates one (dormant). */
  availablePacks?: PeaksPack[];
  /** Per-task consumption over the current period. */
  usage?: { byTask: UsageByTask[]; total: number; periodDays: number };
}

type State =
  | { status: "loading" }
  | { status: "notlinked"; disconnected: boolean }
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
  const topUp = balance.topUpBalance ?? 0;
  const exhausted = balance.remaining <= 0; // window AND top-up both spent

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
        {topUp > 0 &&
          (balance.topUpUsable ? (
            <Text as="p" variant="bodySm" tone="success">
              Includes {topUp.toLocaleString()} top-up Peaks — they never expire, yours until used.
            </Text>
          ) : (
            <Text as="p" variant="bodySm" tone="subdued">
              {topUp.toLocaleString()} top-up Peaks on hold — they never expire, and become usable
              once you&rsquo;re on a paid plan.
            </Text>
          ))}
        {exhausted ? (
          <Banner tone="critical">
            <Text as="p" variant="bodyMd">
              You&rsquo;ve used all your Peaks for this period. Upgrade your plan for a higher
              allowance, top up below, or wait until they reset.
            </Text>
          </Banner>
        ) : atHardCap && topUp > 0 ? (
          <Banner tone="warning">
            <Text as="p" variant="bodyMd">
              You&rsquo;ve hit your plan allowance — now drawing from your top-up Peaks.
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

function UsageBreakdown({
  usage,
}: {
  usage: { byTask: UsageByTask[]; total: number; periodDays: number };
}) {
  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center" wrap={false}>
          <Text as="h2" variant="headingMd">
            Where your Peaks go
          </Text>
          {usage.byTask.length > 0 && (
            <Text as="span" variant="bodySm" tone="subdued">
              last {usage.periodDays} days · {usage.total.toLocaleString()} Peaks
            </Text>
          )}
        </InlineStack>
        <Text as="p" variant="bodySm" tone="subdued">
          What you&rsquo;ve actually spent Peaks on this period, by task.
        </Text>
        <Divider />
        {usage.byTask.length > 0 ? (
          <DataTable
            columnContentTypes={["text", "numeric", "numeric"]}
            headings={["Task", "Peaks used", "Times"]}
            rows={usage.byTask.map((t) => [
              t.label,
              t.peaks.toLocaleString(),
              t.calls.toLocaleString(),
            ])}
          />
        ) : (
          <Box paddingBlock="400">
            <Text as="p" variant="bodyMd" tone="subdued">
              No Peaks used yet this period — your usage by task will appear here.
            </Text>
          </Box>
        )}
      </BlockStack>
    </Card>
  );
}

function BuyPeaks({ packs, gated }: { packs: PeaksPack[]; gated: boolean }) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buy = useCallback(async (packKey: string) => {
    setBusyKey(packKey);
    setError(null);
    const token = await getSessionToken();
    if (!token) {
      setError("Couldn't get a Shopify session. Please reopen Peakhour from your admin.");
      setBusyKey(null);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/v1/shopify/embedded/peaks/purchase`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ packKey }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        confirmationUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.confirmationUrl) {
        setError(data.error || "Could not start checkout. Please try again.");
        setBusyKey(null);
        return;
      }
      // Break out of the admin iframe to Shopify's hosted approval page.
      (window.top ?? window).location.href = data.confirmationUrl;
    } catch {
      setError("Network error starting checkout.");
      setBusyKey(null);
    }
  }, []);

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          Buy more Peaks
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          One-time top-ups — they never expire, yours until used. Usable on a paid plan; billed
          through Shopify.
        </Text>
        <Divider />
        {gated && (
          <Banner tone="warning">
            <Text as="p" variant="bodyMd">
              Peaks require an active paid Peakhour plan. Upgrade your plan to buy and use Peaks.
            </Text>
          </Banner>
        )}
        {error && (
          <Banner tone="critical">
            <Text as="p" variant="bodyMd">
              {error}
            </Text>
          </Banner>
        )}
        <BlockStack gap="300">
          {packs.map((p) => (
            <InlineStack key={p.key} align="space-between" blockAlign="center" wrap={false} gap="300">
              <BlockStack gap="050">
                <Text as="span" variant="bodyMd" fontWeight="semibold">
                  {p.credits.toLocaleString()} Peaks
                </Text>
                <Text as="span" variant="bodySm" tone="subdued">
                  {p.currency === "USD" ? "$" : `${p.currency} `}
                  {p.amount}
                </Text>
              </BlockStack>
              <Button
                onClick={() => buy(p.key)}
                loading={busyKey === p.key}
                disabled={gated || busyKey !== null}
                variant="primary"
              >
                Buy
              </Button>
            </InlineStack>
          ))}
        </BlockStack>
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
          // 404 = never linked (Connect), 400 = store inactive/disconnected (Reconnect).
          setState({ status: "notlinked", disconnected: res.status === 400 });
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
  if (state.status === "notlinked")
    return <LensActivationHub shop={shop} status={state.disconnected ? "disconnected" : undefined} />;

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
        {state.data.usage && <UsageBreakdown usage={state.data.usage} />}
        {state.data.availablePacks && state.data.availablePacks.length > 0 && (
          <BuyPeaks
            packs={state.data.availablePacks}
            gated={
              !state.data.balance.unlimited && !state.data.balance.topUpUsable
            }
          />
        )}
        <RateCard useCases={state.data.rateCard.useCases} />
      </BlockStack>
    </Page>
  );
}
