"use client";

import { useCallback, useRef, useState } from "react";
import {
  Page,
  Card,
  BlockStack,
  InlineStack,
  InlineGrid,
  Text,
  Button,
  Banner,
  Badge,
  Box,
  Divider,
  Modal,
  ChoiceList,
  TextField,
  List,
  SkeletonPage,
  SkeletonBodyText,
  SkeletonDisplayText,
} from "@shopify/polaris";
import { getSessionToken } from "../_lib/session";
import { useEmbeddedContext } from "../_lib/context";
import { CommerceDisconnected } from "../_components/commerce-disconnected";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

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

/** Churn reasons — values MUST mirror the cmrc_disconnect_feedback enum. */
const REASON_CHOICES = [
  { label: "Just testing", value: "just_testing" },
  { label: "Too expensive", value: "too_expensive" },
  { label: "Missing features", value: "missing_features" },
  { label: "Switching tools", value: "switching_tools" },
  { label: "Store inactive", value: "store_inactive" },
  { label: "Other", value: "other" },
];

function SettingsSkeleton() {
  return (
    <SkeletonPage title="Settings">
      <BlockStack gap="500">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <BlockStack gap="400">
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={2} />
            </BlockStack>
          </Card>
        ))}
      </BlockStack>
    </SkeletonPage>
  );
}

// ── Welcome to Insights Network (post-downgrade) ───────────────────────────────

function GrowthNetworkWelcome({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Page title="You're on the free plan">
      <Card>
        <BlockStack gap="400">
          <Text as="h2" variant="headingLg">
            Welcome to the Peakhour Insights Network
          </Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            Your store stays connected and your catalog keeps syncing. You&rsquo;re now part of a
            community of founders and operators using AI to grow smarter — at no cost.
          </Text>
          <List>
            <List.Item>Industry insights &amp; growth trends</List.Item>
            <List.Item>Community benchmarks for stores like yours</List.Item>
            <List.Item>AI-powered recommendations</List.Item>
            <List.Item>Early access to new features</List.Item>
          </List>
          <InlineStack gap="300">
            <Button variant="primary" url="/shopify/embedded/pin">
              Explore Insights Network
            </Button>
            <Button variant="tertiary" url="/shopify/embedded/subscription">
              Back to Commerce
            </Button>
            <Button variant="plain" onClick={onDismiss}>
              Back to settings
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>
    </Page>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { ctx, loading, refresh } = useEmbeddedContext();

  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Disconnect modal: closed → confirm ("Before You Leave") → reason step.
  const [modalStep, setModalStep] = useState<"closed" | "confirm" | "reason">("closed");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reason, setReason] = useState<string[]>([]);
  const [details, setDetails] = useState("");
  // One-time post-downgrade welcome screen (store stays connected).
  const [flash, setFlash] = useState<null | "downgraded">(null);

  const shop = ctx?.shop;

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
        syncTimerRef.current = setTimeout(() => setSyncing(false), 5000);
      }
    } catch {
      setSyncError("Network error triggering sync.");
      setSyncing(false);
    }
  }, []);

  const closeModal = useCallback(() => {
    if (busy) return;
    setModalStep("closed");
    setActionError(null);
  }, [busy]);

  // Primary retention path: keep the store connected, cancel only the paid sub.
  const continueOnFree = useCallback(async () => {
    setBusy(true);
    setActionError(null);
    const token = await getSessionToken();
    if (!token) {
      setActionError("Couldn't get a Shopify session. Please reopen from your admin.");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/v1/shopify/embedded/billing/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      // 404 = "No active subscription found": the goal (no paid sub on this
      // store) is already met — a store entitled via another store, a trial,
      // or a manual grant. Treat it as success and land on the free welcome
      // rather than dead-ending the retention path on a raw error.
      if (!res.ok && res.status !== 404) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setActionError(data.error ?? "Could not update your plan. Please try again.");
        setBusy(false);
        return;
      }
      setModalStep("closed");
      setBusy(false);
      setFlash("downgraded");
      void refresh();
    } catch {
      setActionError("Network error updating your plan.");
      setBusy(false);
    }
  }, [refresh]);

  // Full disconnect — drop the token, mark disconnected, capture the reason.
  const disconnectCompletely = useCallback(async () => {
    setBusy(true);
    setActionError(null);
    const token = await getSessionToken();
    if (!token) {
      setActionError("Couldn't get a Shopify session. Please reopen from your admin.");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/v1/shopify/embedded/disconnect`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(reason[0] ? { reason: reason[0] } : {}),
          ...(details.trim() ? { details: details.trim() } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { disconnected?: boolean; error?: string };
      if (!res.ok || !data.disconnected) {
        setActionError(data.error ?? "Could not disconnect. Please try again.");
        setBusy(false);
        return;
      }
      // Stay in the app — refresh context so this page re-renders to the
      // in-app Commerce Disconnected state. No redirect into OAuth.
      setModalStep("closed");
      setBusy(false);
      void refresh();
    } catch {
      setActionError("Network error disconnecting.");
      setBusy(false);
    }
  }, [reason, details, refresh]);

  // ── Render states ──────────────────────────────────────────────────────────

  if (loading && !ctx) return <SettingsSkeleton />;

  if (!ctx) {
    return (
      <Page title="Settings">
        <Banner tone="critical" title="Could not load settings">
          <Text as="p" variant="bodyMd">
            Couldn&rsquo;t get a Shopify session. Please reopen Peakhour from your Shopify admin.
          </Text>
        </Banner>
      </Page>
    );
  }

  if (flash === "downgraded") {
    return <GrowthNetworkWelcome onDismiss={() => setFlash(null)} />;
  }

  if (!ctx.connected) {
    // Disconnected (or never linked) — one consistent, no-dead-end state.
    return (
      <CommerceDisconnected
        shop={shop}
        pageTitle="Settings"
        heading={ctx.status === "disconnected" ? "Commerce Disconnected" : "Set up Peakhour Commerce"}
      />
    );
  }

  const storeName = ctx.storeName || ctx.shop;
  const hasPaid = Boolean(ctx.assistantActive);

  return (
    <Page title="Settings" subtitle={storeName}>
      <BlockStack gap="500">
        {/* ── Card 1 — Store information ──────────────────────────────── */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Store information</Text>
            <Divider />
            <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">Store name</Text>
                <Text as="p" variant="bodyMd" fontWeight="semibold">{storeName}</Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">Shop domain</Text>
                <Text as="p" variant="bodyMd" fontWeight="semibold">{ctx.shop}</Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">Peakhour account</Text>
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  {ctx.accountEmail || "—"}
                </Text>
              </BlockStack>
              {ctx.currency && (
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">Currency</Text>
                  <Text as="p" variant="bodyMd" fontWeight="semibold">{ctx.currency}</Text>
                </BlockStack>
              )}
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">Connection</Text>
                <Box>{connectionBadge(ctx.connectionStatus)}</Box>
              </BlockStack>
            </InlineGrid>
          </BlockStack>
        </Card>

        {/* ── Card 2 — Sync ───────────────────────────────────────────── */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">Catalog sync</Text>
              <Button
                onClick={handleSync}
                loading={syncing}
                disabled={syncing}
                size="slim"
                variant="secondary"
              >
                Sync now
              </Button>
            </InlineStack>
            <Divider />
            <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">Products synced</Text>
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  {ctx.productsCount != null ? ctx.productsCount.toLocaleString() : "—"}
                </Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" tone="subdued">Last synced</Text>
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  {formatSyncTime(ctx.productsSyncedAt)}
                </Text>
              </BlockStack>
            </InlineGrid>
            {syncError && (
              <Banner tone="critical">
                <Text as="p" variant="bodyMd">{syncError}</Text>
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

        {/* ── Card 3 — Disconnect ─────────────────────────────────────── */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Disconnect</Text>
            <Divider />
            <Text as="p" variant="bodyMd" tone="subdued">
              Want to step back from paid Commerce? You can downgrade to the free plan and keep your
              store connected, or disconnect {ctx.shop} completely. Either way, your catalog is
              preserved and you can come back any time.
            </Text>
            <Box>
              <Button
                onClick={() => { setActionError(null); setModalStep("confirm"); }}
                tone="critical"
              >
                Disconnect store
              </Button>
            </Box>
          </BlockStack>
        </Card>
      </BlockStack>

      {/* ── "Before You Leave" confirmation ───────────────────────────── */}
      <Modal
        open={modalStep === "confirm"}
        onClose={closeModal}
        title="Before you leave…"
        primaryAction={{
          content: hasPaid ? "Continue on Free Plan" : "Keep store connected",
          loading: busy,
          onAction: hasPaid ? continueOnFree : closeModal,
        }}
        secondaryActions={[
          {
            content: "Disconnect completely",
            destructive: true,
            disabled: busy,
            onAction: () => { setActionError(null); setModalStep("reason"); },
          },
          { content: "Cancel", disabled: busy, onAction: closeModal },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            {actionError && (
              <Banner tone="critical">
                <Text as="p" variant="bodyMd">{actionError}</Text>
              </Banner>
            )}
            <Text as="p" variant="bodyMd">Disconnecting Shopify will:</Text>
            <List>
              <List.Item>Disable the Commerce Assistant</List.Item>
              <List.Item>Stop catalog syncing</List.Item>
              <List.Item>Remove Commerce Insights</List.Item>
              <List.Item>Pause AI-powered recommendations</List.Item>
            </List>
            <Text as="p" variant="bodyMd">
              {hasPaid
                ? "You can stay on Peakhour's free Insights Network at no cost — keep your store connected and drop the paid Commerce Assistant."
                : "You can keep your store connected on the free plan and continue using the Insights Network at no cost."}
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* ── Churn reason step (skippable) ─────────────────────────────── */}
      <Modal
        open={modalStep === "reason"}
        onClose={closeModal}
        title="Disconnect completely?"
        primaryAction={{
          content: "Disconnect completely",
          destructive: true,
          loading: busy,
          onAction: disconnectCompletely,
        }}
        secondaryActions={[
          { content: "Back", disabled: busy, onAction: () => { setActionError(null); setModalStep("confirm"); } },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            {actionError && (
              <Banner tone="critical">
                <Text as="p" variant="bodyMd">{actionError}</Text>
              </Banner>
            )}
            <Text as="p" variant="bodyMd">
              This unlinks {ctx.shop} and cancels any active Commerce Assistant subscription. Your
              product catalog is preserved and you can reconnect at any time.
            </Text>
            <ChoiceList
              title="Why are you leaving? (optional)"
              choices={REASON_CHOICES}
              selected={reason}
              onChange={setReason}
            />
            <TextField
              label="Anything else? (optional)"
              value={details}
              onChange={setDetails}
              autoComplete="off"
              multiline={2}
              maxLength={2000}
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
