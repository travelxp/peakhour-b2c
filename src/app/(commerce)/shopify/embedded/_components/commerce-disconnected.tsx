"use client";

import { Page, EmptyState, Text } from "@shopify/polaris";
import { reconnectUrl } from "../_lib/context";

/** Shared illustration for the Commerce setup / disconnected states. One asset
 *  everywhere so the experience is consistent (Disconnect Redesign §12). */
const SETUP_IMAGE = "https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg";

interface CommerceDisconnectedProps {
  shop?: string | null;
  /** "Commerce Disconnected" (recovery) vs the default setup framing. */
  heading?: string;
  description?: string;
  /** Wrap in a Polaris <Page> (standalone page use) or return bare (inside an
   *  already-titled page / card). Defaults to standalone. */
  withPage?: boolean;
  pageTitle?: string;
  /** Show the "Explore Growth Network" secondary CTA. Off on the Growth
   *  Network page itself (would be self-referential). Defaults on. */
  showGrowthNetworkLink?: boolean;
}

/**
 * The single, consistent "no live Commerce connection" state — used for both a
 * never-linked store and a disconnected one (Disconnect Redesign §1, §2, §10).
 * Always gives the merchant a next action: Reconnect Shopify (primary, escapes
 * the admin iframe to re-run OAuth) or Explore Growth Network (secondary, the
 * free destination). No blank screens, no dead ends.
 */
export function CommerceDisconnected({
  shop,
  heading = "Set up Peakhour Commerce",
  description = "Your Peakhour account is still active. Reconnect your Shopify store to sync your catalog, enable the AI Commerce Assistant, unlock product insights, and get AI-powered recommendations.",
  withPage = true,
  pageTitle = "Commerce",
  showGrowthNetworkLink = true,
}: CommerceDisconnectedProps) {
  const content = (
    <EmptyState
      heading={heading}
      action={{
        content: "Reconnect Shopify",
        // Top-level navigation escapes the admin iframe so OAuth can run; a
        // relative redirect would only move the iframe itself.
        onAction: () => {
          (window.top ?? window).location.href = reconnectUrl(shop);
        },
      }}
      secondaryAction={
        showGrowthNetworkLink
          ? {
              content: "Explore Growth Network",
              // In-iframe client nav (Polaris linkComponent = Next Link).
              url: "/shopify/embedded/pin",
            }
          : undefined
      }
      image={SETUP_IMAGE}
    >
      <Text as="p" variant="bodyMd">
        {description}
      </Text>
    </EmptyState>
  );

  if (!withPage) return content;
  return <Page title={pageTitle}>{content}</Page>;
}
