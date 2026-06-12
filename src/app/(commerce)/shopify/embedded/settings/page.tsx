"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  List,
  Modal,
  EmptyState,
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
  currency?: string | null;
  productsSyncedAt?: string | null;
  connectionStatus?: string | null;
  productsCount?: number;
}

interface PinState {
  consentStatus?: { pin_contribution?: "opted_in" | "revoked" };
}

// Truthful-today framing (matches the wizard): benchmarks ship to members
// FIRST as they roll out — never claimed as visible now.
const PIN_BENEFITS = [
  "Early access: benchmarks for stores like yours reach members first",
  "Help shape sharper AI recommendations as the network learns",
  "Only anonymized cohort signals are shared — never products, customers, or revenue",
];

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; ctx: ContextData };

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

// ── Skeleton ───────────────────────────────────────────────────────────────

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

// ── Main component ─────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  // Tri-state + unknown: a member whose status fetch failed must NOT be shown
  // a "Join" button (withdraw has to stay as discoverable as join), so the
  // action is hidden until membership is actually known.
  const [pinMembership, setPinMembership] = useState<"loading" | "member" | "nonmember" | "unknown">("loading");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      const token = await getSessionToken();
      if (ctrl.signal.aborted) return;
      if (!token) {
        setState({ status: "error", message: "Couldn't get a Shopify session. Please reopen Peakhour from your Shopify admin." });
        return;
      }
      try {
        const res = await fetch(`${API_URL}/v1/shopify/embedded/context`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: ctrl.signal,
        });
        if (ctrl.signal.aborted) return;
        if (!res.ok) {
          setState({ status: "error", message: `Could not load settings (${res.status}).` });
          return;
        }
        const ctx = (await res.json()) as ContextData;
        setState({ status: "ready", ctx });

        // PIN membership is secondary content — fetch after the page is ready.
        // On failure the membership is "unknown" and the card hides its action
        // (never show "Join" to someone who may already be a member).
        if (ctx.connected) {
          try {
            const pinRes = await fetch(`${API_URL}/v1/shopify/embedded/pin/status`, {
              headers: { Authorization: `Bearer ${token}` },
              signal: ctrl.signal,
            });
            if (ctrl.signal.aborted) return;
            if (pinRes.ok) {
              const data = (await pinRes.json()) as { pin?: PinState | null };
              setPinMembership(
                data.pin?.consentStatus?.pin_contribution === "opted_in" ? "member" : "nonmember",
              );
            } else {
              setPinMembership("unknown");
            }
          } catch (err) {
            if ((err as { name?: string }).name === "AbortError") return;
            setPinMembership("unknown");
          }
        }
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        setState({ status: "error", message: "Network error loading settings." });
      }
    })();
    return () => ctrl.abort();
  }, []);

  const togglePin = useCallback(async (join: boolean) => {
    setPinBusy(true);
    setPinError(null);
    const token = await getSessionToken();
    if (!token) {
      setPinError("Couldn't get a Shopify session. Please reopen from your admin.");
      setPinBusy(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/v1/shopify/embedded/pin/consent`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: join ? "opt_in" : "withdraw" }),
      });
      if (!res.ok) {
        setPinError("Could not update your Insights Network membership. Please try again.");
      } else {
        setPinMembership(join ? "member" : "nonmember");
      }
    } catch {
      setPinError("Network error updating membership.");
    }
    setPinBusy(false);
  }, []);

  // Clear the pending sync-feedback timer on unmount (no setState after unmount).
  useEffect(() => () => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
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
        // Fire-and-forget queued — keep the "Sync started" banner for a few
        // seconds of feedback, then clear (refresh shows updated counts).
        syncTimerRef.current = setTimeout(() => setSyncing(false), 5000);
      }
    } catch {
      setSyncError("Network error triggering sync.");
      setSyncing(false);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (state.status !== "ready") return;
    setDisconnecting(true);
    setDisconnectError(null);
    const token = await getSessionToken();
    if (!token) {
      setDisconnectError("Couldn't get a Shopify session. Please reopen from your admin.");
      setDisconnecting(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/v1/shopify/embedded/disconnect`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => ({}))) as { disconnected?: boolean; error?: string };
      if (!res.ok || !data.disconnected) {
        setDisconnectError(data.error ?? "Could not disconnect. Please try again.");
        setDisconnecting(false);
        return;
      }
      // Back into the connect flow — top-level navigation escapes the admin
      // iframe (a relative redirect would only move the iframe itself).
      const connectUrl = `/shopify/connect?shop=${encodeURIComponent(state.ctx.shop)}&reconnect=1`;
      (window.top ?? window).location.href = connectUrl;
    } catch {
      setDisconnectError("Network error disconnecting.");
      setDisconnecting(false);
    }
  }, [state]);

  // ── Render states ────────────────────────────────────────────────────────

  if (state.status === "loading") return <SettingsSkeleton />;

  if (state.status === "error") {
    return (
      <Page title="Settings">
        <Banner tone="critical" title="Could not load settings">
          <Text as="p" variant="bodyMd">{state.message}</Text>
        </Banner>
      </Page>
    );
  }

  const { ctx } = state;

  if (!ctx.connected) {
    const connectUrl = ctx.shop
      ? `/shopify/connect?shop=${encodeURIComponent(ctx.shop)}&reconnect=1`
      : "/shopify/connect";
    return (
      <Page title="Settings">
        <EmptyState
          heading="Link your Peakhour account"
          action={{
            content: "Set up Peakhour Commerce",
            onAction: () => { (window.top ?? window).location.href = connectUrl; },
          }}
          image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
        >
          <Text as="p" variant="bodyMd">
            {ctx.shop ? `${ctx.shop} isn't` : "This store isn't"} linked to a Peakhour account
            yet. Finish setup to manage your store settings here.
          </Text>
        </EmptyState>
      </Page>
    );
  }

  const storeName = ctx.storeName || ctx.shop;

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

        {/* ── Card 3 — Insights Network (PIN consent) ─────────────────── */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">Peakhour Insights Network</Text>
              {pinMembership === "member" && <Badge tone="success">Member</Badge>}
            </InlineStack>
            <Divider />
            {pinMembership === "member" ? (
              <Text as="p" variant="bodyMd" tone="subdued">
                Your store contributes anonymized cohort signals — and members get
                benchmarks and network insights first as they roll out. Only country,
                industry, size, and platform-level aggregates are shared — never
                products, customers, or revenue.
              </Text>
            ) : (
              <BlockStack gap="300">
                <Text as="p" variant="bodyMd" tone="subdued">
                  Join the network to get member-first access to benchmarks and
                  network-powered insights as they roll out — included free on the
                  Lens plan.
                </Text>
                <List type="bullet">
                  {PIN_BENEFITS.map((b) => (
                    <List.Item key={b}>
                      <Text as="span" variant="bodyMd">{b}</Text>
                    </List.Item>
                  ))}
                </List>
              </BlockStack>
            )}
            {pinError && (
              <Banner tone="critical">
                <Text as="p" variant="bodyMd">{pinError}</Text>
              </Banner>
            )}
            {pinMembership === "member" && (
              <Box>
                <Button onClick={() => togglePin(false)} loading={pinBusy} variant="plain" tone="critical">
                  Leave the network
                </Button>
              </Box>
            )}
            {pinMembership === "nonmember" && (
              <Box>
                <Button onClick={() => togglePin(true)} loading={pinBusy} variant="primary">
                  Join the network
                </Button>
              </Box>
            )}
            {pinMembership === "unknown" && (
              <Text as="p" variant="bodySm" tone="subdued">
                Membership status is unavailable right now — refresh the page to manage it.
              </Text>
            )}
          </BlockStack>
        </Card>

        {/* ── Card 4 — Danger zone ────────────────────────────────────── */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Danger zone</Text>
            <Divider />
            <Banner tone="critical" title="Disconnect this store">
              <Text as="p" variant="bodyMd">
                Disconnecting unlinks {ctx.shop} from your Peakhour account and cancels any
                active Commerce Assistant subscription. Your product catalog is preserved
                and you can reconnect at any time.
              </Text>
            </Banner>
            <Box>
              <Button
                onClick={() => { setDisconnectError(null); setModalOpen(true); }}
                variant="primary"
                tone="critical"
              >
                Disconnect store
              </Button>
            </Box>
          </BlockStack>
        </Card>
      </BlockStack>

      {/* ── Disconnect confirmation ───────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => { if (!disconnecting) setModalOpen(false); }}
        title="Disconnect store?"
        primaryAction={{
          content: "Disconnect",
          destructive: true,
          loading: disconnecting,
          onAction: handleDisconnect,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            disabled: disconnecting,
            onAction: () => setModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            {/* Error must render INSIDE the modal — a banner in the card behind
                the overlay would be invisible while the modal is open. */}
            {disconnectError && (
              <Banner tone="critical">
                <Text as="p" variant="bodyMd">{disconnectError}</Text>
              </Banner>
            )}
            <Text as="p" variant="bodyMd">
              This will disconnect {ctx.shop} from Peakhour and cancel any active Commerce
              Assistant subscription. Your product catalog will be preserved. You can
              reconnect at any time.
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
