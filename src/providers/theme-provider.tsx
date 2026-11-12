"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { forcedThemeFor } from "@/lib/route-theme";

export function ThemeProvider({
  children,
  nonce,
}: {
  children: React.ReactNode;
  /** The request's CSP nonce. Without it the production CSP blocks
   *  next-themes' pre-paint script, and a dark-mode device sees the app
   *  paint light and then flip to dark at hydration. */
  nonce?: string;
}) {
  // Public pages are always light; the signed-in app follows the device.
  // See lib/route-theme.ts.
  const forcedTheme = forcedThemeFor(usePathname());
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      forcedTheme={forcedTheme}
      nonce={nonce}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
