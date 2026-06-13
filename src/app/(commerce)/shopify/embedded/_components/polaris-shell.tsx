"use client";

import { AppProvider, Frame, Navigation } from "@shopify/polaris";
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
  // PIN gets its own surface (product rule 2026-06-12): consent is captured
  // first-time in the connect wizard; this page is its standing home —
  // members see the network, non-members get the consent nudge.
  { label: "Insights Network", icon: GlobeIcon, url: "/shopify/embedded/pin" },
  { label: "Subscription", icon: CreditCardIcon, url: "/shopify/embedded/subscription" },
  { label: "Settings", icon: SettingsIcon, url: "/shopify/embedded/settings" },
];

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
      <Frame
        navigation={navMarkup}
        showMobileNavigation={mobileNavOpen}
        onNavigationDismiss={() => setMobileNavOpen(false)}
      >
        {children}
      </Frame>
    </AppProvider>
  );
}
