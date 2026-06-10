"use client";

import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import type { ReactNode } from "react";

/**
 * Minimal Polaris AppProvider for the /shopify/connect bridge page.
 * No Frame/Navigation/App Bridge — this is a regular browser page,
 * not an embedded iframe. Polaris is used here for visual consistency
 * with the embedded admin surface.
 */
export function ConnectShell({ children }: { children: ReactNode }) {
  return <AppProvider i18n={enTranslations}>{children}</AppProvider>;
}
