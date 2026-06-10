"use client";

import { AppProvider, Frame, Navigation } from "@shopify/polaris";
import {
  HomeIcon,
  ProductIcon,
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
function PolarisLink({ url, children, ...rest }: PolarisLinkProps) {
  return (
    <NextLink href={url ?? "#"} {...rest}>
      {children}
    </NextLink>
  );
}

const NAV_ITEMS = [
  { label: "Home", icon: HomeIcon, url: "/shopify/embedded", exactMatch: true },
  { label: "Catalog", icon: ProductIcon, url: "/shopify/embedded/catalog" },
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
