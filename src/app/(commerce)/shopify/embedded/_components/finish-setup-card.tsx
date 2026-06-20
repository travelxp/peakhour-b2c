"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, BlockStack, InlineStack, Text, Button, Badge, Banner } from "@shopify/polaris";
import { getSessionToken } from "../_lib/session";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
// Namespaced per shop — embedded apps are inherently multi-store, so a single
// global key would suppress the card on store B after dismissing it on store A.
function dismissKey(shop?: string | null): string {
  return `ph_finish_setup_dismissed:${shop ?? "default"}`;
}

/**
 * Dismissible "Finish setup" card shown on the CONNECTED home when the merchant
 * is on free Lens but hasn't joined the Peakhour Insights Network yet — the
 * soft, non-naggy completion of the activation journey (step 2 of 3). The
 * full-takeover journey lives in LensActivationHub (disconnected state); this is
 * its connected tail.
 *
 * Self-contained: reads membership from /pin/status, opts in via /pin/consent,
 * and remembers a dismissal in localStorage so it never nags twice. Renders
 * nothing unless the merchant is a known non-member and hasn't dismissed it
 * (fails closed — on any load error it stays hidden rather than nagging).
 */
export function FinishSetupCard({ shop }: { shop?: string | null }) {
  // null = unknown/loading/errored (render nothing); false = non-member (show);
  // true = member (nothing to finish).
  const [member, setMember] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(true); // hidden until we confirm otherwise (no flash)
  const [justJoined, setJustJoined] = useState(false); // brief success confirmation
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let isDismissed = true;
      try {
        isDismissed = localStorage.getItem(dismissKey(shop)) === "1";
      } catch {
        isDismissed = false; // storage blocked — default to showing once
      }
      const token = await getSessionToken();
      if (cancelled) return;
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/v1/shopify/embedded/pin/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (!res.ok) return; // notlinked/blip — stay hidden
        const data = (await res.json()) as {
          pin?: { consentStatus?: { pin_contribution?: "opted_in" | "revoked" } } | null;
        };
        const isMember = data.pin?.consentStatus?.pin_contribution === "opted_in";
        setMember(isMember);
        setDismissed(isMember ? true : isDismissed);
      } catch {
        // stay hidden on error
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shop]);

  const join = useCallback(async () => {
    setBusy(true);
    setError(null);
    const token = await getSessionToken();
    if (!token) {
      setError("Couldn't get a Shopify session. Please reopen Peakhour from your Shopify admin.");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/v1/shopify/embedded/pin/consent`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "opt_in" }),
      });
      if (res.ok) {
        setMember(true);
        setJustJoined(true); // show a brief confirmation instead of silently vanishing
      } else {
        setError("Could not join the Insights Network. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setBusy(false);
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(dismissKey(shop), "1");
    } catch {
      // non-fatal — it just won't persist across reloads
    }
    setDismissed(true);
  }, [shop]);

  // Success confirmation takes precedence — the merchant just clicked Join, so
  // confirm it landed (the guard below would otherwise hide the card instantly).
  if (justJoined) {
    return (
      <div className="ph-hover-lift">
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center" wrap={false}>
              <InlineStack gap="200" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  You&rsquo;re in the Insights Network
                </Text>
                <Badge tone="success">Joined</Badge>
              </InlineStack>
              <Button
                variant="tertiary"
                onClick={() => setJustJoined(false)}
                accessibilityLabel="Dismiss"
              >
                Dismiss
              </Button>
            </InlineStack>
            <Text as="p" variant="bodyMd" tone="subdued">
              Setup complete. You&rsquo;ll get privacy-first benchmarks and insights for stores like
              yours here as the network grows.
            </Text>
            <InlineStack gap="300">
              <Button variant="tertiary" url="/shopify/embedded/pin">
                View Insights Network
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>
      </div>
    );
  }

  if (member !== false || dismissed) return null;

  return (
    <div className="ph-hover-lift">
      <Card>
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center" wrap={false}>
            <InlineStack gap="200" blockAlign="center">
              <Text as="h2" variant="headingMd">
                Finish setup
              </Text>
              <Badge tone="attention">2 of 3</Badge>
            </InlineStack>
            <Button variant="tertiary" onClick={dismiss} accessibilityLabel="Dismiss finish setup">
              Dismiss
            </Button>
          </InlineStack>
          <Text as="p" variant="bodyMd" tone="subdued">
            Your store is connected and you&rsquo;re on the free Lens plan. Join the Peakhour Insights
            Network for privacy-first benchmarks and insights for stores like yours — free, opt-in,
            leave anytime.
          </Text>
          {error && (
            <Banner tone="critical">
              <Text as="p" variant="bodyMd">
                {error}
              </Text>
            </Banner>
          )}
          <InlineStack gap="300" blockAlign="center">
            <Button variant="primary" onClick={join} loading={busy}>
              Join the Insights Network
            </Button>
            <Button variant="tertiary" url="/shopify/embedded/pin">
              Learn more
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>
    </div>
  );
}
