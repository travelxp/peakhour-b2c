"use client";

import { AppProvider, Frame, Navigation, Banner, Box, Text } from "@shopify/polaris";
import {
  HomeIcon,
  ChatIcon,
  ProductIcon,
  ConnectIcon,
  GlobeIcon,
  CreditCardIcon,
  SettingsIcon,
} from "@shopify/polaris-icons";
import type { AppProviderProps } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { usePathname } from "next/navigation";
import NextLink from "next/link";
import { useState, type ReactNode } from "react";
import {
  EmbeddedContextProvider,
  useEmbeddedContext,
  reconnectUrl,
} from "../_lib/context";

type PolarisLinkComponent = NonNullable<AppProviderProps["linkComponent"]>;
type PolarisLinkProps = React.ComponentPropsWithoutRef<PolarisLinkComponent>;

// Teach Polaris to use Next.js Link so Navigation clicks are client-side
// (no full-page reload inside the Shopify Admin iframe).
//
// `external`: Polaris forwards it to the custom link component, but NextLink
// IGNORES it — so `<Button url external>` would client-navigate the admin
// IFRAME to the target (trapping the merchant; the cookie-authed dashboard
// can't even load inside the iframe) instead of opening a real new tab. Honor
// it with a plain anchor so "Open Peakhour Dashboard" (Home/Settings) actually
// escapes the iframe.
function PolarisLink({ url, external, children, ...rest }: PolarisLinkProps) {
  if (external) {
    return (
      <a href={url ?? "#"} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    );
  }
  return (
    <NextLink href={url ?? "#"} {...rest}>
      {children}
    </NextLink>
  );
}

const NAV_ITEMS = [
  { label: "Home", icon: HomeIcon, url: "/shopify/embedded", exactMatch: true },
  // The assistant is the product (P1.11) — test it in-app, no WhatsApp needed.
  { label: "Assistant", icon: ChatIcon, url: "/shopify/embedded/assistant" },
  { label: "Catalog", icon: ProductIcon, url: "/shopify/embedded/catalog" },
  // WhatsApp (and future channels) connect here (P1.12, launch-to-domain).
  { label: "Integrations", icon: ConnectIcon, url: "/shopify/embedded/integrations" },
  // The free Growth Network (formerly "Insights Network") — its own surface
  // (product rule 2026-06-12): consent is captured first-time in the connect
  // wizard; this page is its standing home — members see the network,
  // non-members get the join nudge. Positioned as a valuable destination.
  { label: "Growth Network", icon: GlobeIcon, url: "/shopify/embedded/pin" },
  { label: "Subscription", icon: CreditCardIcon, url: "/shopify/embedded/subscription" },
  { label: "Settings", icon: SettingsIcon, url: "/shopify/embedded/settings" },
];

/**
 * Persistent reconnect banner shown on EVERY embedded page while the store is
 * disconnected (Disconnect Redesign §11). Keyed on the raw `status` so it only
 * fires for a truly-disconnected store — never on a fresh, never-linked install
 * (which also reports connected:false but has no `status`).
 */
function ReconnectBanner() {
  const { ctx } = useEmbeddedContext();
  if (ctx?.status !== "disconnected") return null;
  return (
    <Box padding="400" paddingBlockEnd="0">
      <Banner
        tone="warning"
        title="Commerce is disconnected"
        action={{
          content: "Reconnect Shopify",
          onAction: () => {
            (window.top ?? window).location.href = reconnectUrl(ctx.shop);
          },
        }}
      >
        <Text as="p" variant="bodyMd">
          Reconnect Shopify to activate your AI Commerce Assistant and Commerce Insights.
        </Text>
      </Banner>
    </Box>
  );
}

export function PolarisShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navMarkup = (
    <Navigation location={pathname}>
      <Navigation.Section items={NAV_ITEMS} />
    </Navigation>
  );

  return (
    <AppProvider i18n={enTranslations} linkComponent={PolarisLink}>
      <EmbeddedContextProvider>
        <Frame
          navigation={navMarkup}
          showMobileNavigation={mobileNavOpen}
          onNavigationDismiss={() => setMobileNavOpen(false)}
        >
          {/* Persistent banner stays outside the keyed wrapper so it doesn't
              re-animate on every in-app navigation. */}
          <ReconnectBanner />
          {/* Keyed by pathname → the entrance animation replays on each
              client-side navigation, giving a smooth page-to-page transition.
              Disabled automatically under prefers-reduced-motion (motion.css). */}
          <div key={pathname} className="ph-fade-in-up">
            {children}
          </div>
        </Frame>
      </EmbeddedContextProvider>
    </AppProvider>
  );
}
