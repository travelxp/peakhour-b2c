"use client";

import { Fragment, type CSSProperties } from "react";
import { Page, Card, BlockStack, InlineStack, Text, Button, Badge, Box, Divider } from "@shopify/polaris";
import { startReconnect } from "../_lib/context";

/**
 * Lens Activation Hub — the single, unified "get started" home for a merchant
 * whose store isn't connected yet (fresh install or disconnected). Replaces the
 * three fragmented CTAs (Connect / Join the Insights Network / Subscribe) with
 * one journey:
 *
 *   1. Connect Shopify              — the only action needed right now
 *   2. Join the Insights Network    — free, opt-in, surfaced right after connecting
 *   3. You're on Lens (free)        — Lens is free by default; no billing step
 *
 * Only step 1 is actionable here (the others require a linked store); steps 2–3
 * are previewed so the merchant sees the whole, low-commitment journey up front.
 * Once connected, the home shows the dashboard with a dismissible FinishSetupCard
 * that completes step 2. Free Lens is an implicit default (no entitlement write),
 * so there is no "subscribe to free" action — by design.
 */

type StepState = "done" | "current" | "upcoming";

interface Step {
  n: number;
  title: string;
  description: string;
  state: StepState;
  action?: { content: string; onAction: () => void };
}

/** Fixed-size circular step marker so every step title aligns on one gutter.
 *  Uses Polaris color tokens (theme-correct in light/dark). Decorative — the
 *  step title carries the meaning, so it's aria-hidden. */
function StepMarker({ state, n }: { state: StepState; n: number }) {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: "9999px",
    flex: "0 0 auto",
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1,
  };
  if (state === "done") {
    return (
      <span
        aria-hidden
        style={{
          ...base,
          background: "var(--p-color-bg-fill-success)",
          color: "var(--p-color-text-on-bg-fill)",
        }}
      >
        ✓
      </span>
    );
  }
  const current = state === "current";
  return (
    <span
      aria-hidden
      style={{
        ...base,
        background: current ? "var(--p-color-bg-fill-brand)" : "var(--p-color-bg-surface-secondary)",
        color: current ? "var(--p-color-text-on-bg-fill)" : "var(--p-color-text-secondary)",
        border: current ? "none" : "1px solid var(--p-color-border)",
      }}
    >
      {n}
    </span>
  );
}

function StepRow({ step }: { step: Step }) {
  return (
    <InlineStack gap="400" blockAlign="start" wrap={false}>
      <StepMarker state={step.state} n={step.n} />
      <BlockStack gap="100">
        <InlineStack gap="200" blockAlign="center">
          <Text as="h3" variant="headingSm">
            {step.title}
          </Text>
          {step.state === "current" && <Badge tone="attention">Do this now</Badge>}
        </InlineStack>
        <Text as="p" variant="bodyMd" tone="subdued">
          {step.description}
        </Text>
        {step.action && step.state === "current" && (
          <Box paddingBlockStart="100">
            <Button variant="primary" onClick={step.action.onAction}>
              {step.action.content}
            </Button>
          </Box>
        )}
      </BlockStack>
    </InlineStack>
  );
}

export function LensActivationHub({ shop, status }: { shop?: string | null; status?: string }) {
  const reconnecting = status === "disconnected";

  const steps: Step[] = [
    {
      n: 1,
      title: reconnecting ? "Reconnect your Shopify store" : "Connect your Shopify store",
      description: reconnecting
        ? "Your Peakhour account is still active — reconnect to resume catalog sync and your AI Commerce Assistant."
        : "Link your store so Peakhour can sync your catalog and power your AI Commerce Assistant.",
      state: "current",
      action: {
        content: reconnecting ? "Reconnect Shopify" : "Connect Shopify",
        onAction: () => {
          void startReconnect(shop);
        },
      },
    },
    {
      n: 2,
      title: "Join the Insights Network",
      description:
        "Free, privacy-first benchmarks and insights for stores like yours through the Peakhour Insights Network (PIN). You'll be invited to join right after connecting — opt-in only, leave anytime.",
      state: "upcoming",
    },
    {
      n: 3,
      title: "You're on Lens — free",
      description:
        "Lens is free, with no card and no charge. Upgrade to the paid Commerce Assistant whenever you want live AI selling on WhatsApp.",
      state: "upcoming",
    },
  ];

  return (
    <Page title="Peakhour Commerce">
      <BlockStack gap="500">
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingLg">
              {reconnecting ? "Reconnect to continue" : "Get started with Lens"}
            </Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Three quick steps — the first is the only one you need right now.
            </Text>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            {steps.map((s, i) => (
              <Fragment key={s.n}>
                {i > 0 && <Divider />}
                <StepRow step={s} />
              </Fragment>
            ))}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
