"use client";

import { AppProvider, Frame, Navigation } from "@shopify/polaris";
import {
  HomeIcon,
  ProductIcon,
  CreditCardIcon,
  SettingsIcon,
} from "@shopify/polaris-icons";
import enTranslations from "@shopify/polaris/locales/en.json";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV_ITEMS = [
  { label: "Home", icon: HomeIcon, url: "/shopify/embedded", exactMatch: true },
  { label: "Catalog", icon: ProductIcon, url: "/shopify/embedded/catalog" },
  { label: "Subscription", icon: CreditCardIcon, url: "/shopify/embedded/subscription" },
  { label: "Settings", icon: SettingsIcon, url: "/shopify/embedded/settings" },
];

export function PolarisShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const navMarkup = (
    <Navigation location={pathname}>
      <Navigation.Section items={NAV_ITEMS} />
    </Navigation>
  );

  return (
    <AppProvider i18n={enTranslations}>
      <Frame navigation={navMarkup}>{children}</Frame>
    </AppProvider>
  );
}
