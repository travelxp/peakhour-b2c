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
  SkeletonPage,
  SkeletonBodyText,
  SkeletonDisplayText,
} from "@shopify/polaris";
import { getSessionToken } from "../_lib/session";
import { reconnectUrl } from "../_lib/context";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * Integrations (P1.12) — where the merchant connects WhatsApp (and, later,
 * other channels). The WhatsApp WABA links to the SAME Peakhour business the
 * store is linked to, so a connection made on peakhour.ai shows up here.
 *
 * Launch-to-domain (forced by architecture): the /shopify CSP blocks the FB
 * SDK and Meta Embedded Signup is cookie-authed, so we can't run the connect
 * popup inside the admin iframe. "Connect WhatsApp" opens the peakhour.ai
 * connect page in a new top-level tab; the merchant connects there and
 * returns — this page reads status via the session-token endpoint.
 */

type WaStatus =
  | { state: "loading" }
  | { state: "notlinked" }
  | { state: "error" }
  | { state: "connected"; name: string | null; phoneNumber: string | null; needsReauth: boolean }
  | { state: "disconnected" };

// Where the cookie-authed WhatsApp Embedded Signup lives on the main app.
const DASHBOARD_WHATSAPP_URL = "/dashboard/content/whatsapp";

function IntegrationsSkeleton() {
  return (
    <SkeletonPage title="Integrations">
      <Card>
        <BlockStack gap="400">
          <SkeletonDisplayText size="small" />
          <SkeletonBodyText lines={2} />
        </BlockStack>
      </Card>
    </SkeletonPage>
  );
}

export default function IntegrationsPage() {
  const [wa, setWa] = useState<WaStatus>({ state: "loading" });
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getSessionToken();
      if (cancelled) return;
      if (!token) {
        setWa({ state: "error" });
        return;
      }
      try {
        const res = await fetch(`${API_URL}/v1/shopify/embedded/whatsapp/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (res.status === 404 || res.status === 400) {
          setWa({ state: "notlinked" });
          return;
        }
        if (!res.ok) {
          setWa({ state: "error" });
          return;
        }
        const d = (await res.json()) as {
          connected?: boolean;
          needsReauth?: boolean;
          name?: string | null;
          phoneNumber?: string | null;
        };
        if (cancelled) return;
        setWa(
          d.connected
            ? { state: "connected", name: d.name ?? null, phoneNumber: d.phoneNumber ?? null, needsReauth: Boolean(d.needsReauth) }
            : { state: "disconnected" },
        );
      } catch {
        if (!cancelled) setWa({ state: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [retryKey]);

  // Open the cookie-authed connect flow on peakhour.ai in a NEW top-level tab
  // (escapes the admin iframe). After connecting there the merchant returns
  // and refreshes status.
  const openConnect = useCallback(() => {
    window.open(DASHBOARD_WHATSAPP_URL, "_blank", "noopener,noreferrer");
  }, []);

  if (wa.state === "loading") return <IntegrationsSkeleton />;

  return (
    <Page title="Integrations" subtitle="Connect the channels your shoppers already use">
      <BlockStack gap="500">
        {/* WhatsApp */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">WhatsApp</Text>
              {wa.state === "connected" && !wa.needsReauth && <Badge tone="success">Connected</Badge>}
              {wa.state === "connected" && wa.needsReauth && <Badge tone="warning">Needs reconnect</Badge>}
              {wa.state === "disconnected" && <Badge>Not connected</Badge>}
            </InlineStack>
            <Divider />

            {wa.state === "connected" ? (
              <BlockStack gap="300">
                <Text as="p" variant="bodyMd">
                  Your catalog-grounded assistant is live on WhatsApp
                  {wa.name ? ` for ${wa.name}` : ""}
                  {wa.phoneNumber ? ` · ${wa.phoneNumber}` : ""}. Shoppers messaging your
                  WhatsApp get answers from your real catalog.
                </Text>
                {wa.needsReauth && (
                  <Banner tone="warning">
                    <Text as="p" variant="bodyMd">
                      Your WhatsApp connection needs to be refreshed. Reconnect to keep the
                      assistant answering.
                    </Text>
                  </Banner>
                )}
                <Box>
                  <Button onClick={openConnect}>Manage on your Peakhour dashboard</Button>
                </Box>
              </BlockStack>
            ) : wa.state === "disconnected" ? (
              <BlockStack gap="300">
                <Text as="p" variant="bodyMd" tone="subdued">
                  Connect your WhatsApp Business number so the assistant can answer your shoppers
                  there — grounded in this store’s catalog. You’ll connect on your Peakhour
                  dashboard (opens in a new tab); it links to the same account as this store.
                </Text>
                <Box>
                  <Button variant="primary" onClick={openConnect}>
                    Connect WhatsApp
                  </Button>
                </Box>
              </BlockStack>
            ) : wa.state === "notlinked" ? (
              <BlockStack gap="300">
                <Text as="p" variant="bodyMd" tone="subdued">
                  Finish linking your store first, then connect WhatsApp from here.
                </Text>
                <Box>
                  <Button
                    onClick={() => {
                      (window.top ?? window).location.href = reconnectUrl();
                    }}
                  >
                    Set up Peakhour Commerce
                  </Button>
                </Box>
              </BlockStack>
            ) : (
              <BlockStack gap="300">
                <Text as="p" variant="bodyMd" tone="subdued">
                  We couldn’t load your WhatsApp status.
                </Text>
                <Box>
                  <Button onClick={() => setRetryKey((k) => k + 1)}>Try again</Button>
                </Box>
              </BlockStack>
            )}
          </BlockStack>
        </Card>

        {/* Future channels — honest "coming soon", no fake controls */}
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">More channels</Text>
            <Divider />
            <Text as="p" variant="bodyMd" tone="subdued">
              On-store chat and other channels are coming — your assistant will answer shoppers
              everywhere they reach you, all grounded in this catalog.
            </Text>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
