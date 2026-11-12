"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { forcedThemeFor } from "@/lib/route-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Public pages are always light; the signed-in app follows the device.
  // See lib/route-theme.ts.
  const forcedTheme = forcedThemeFor(usePathname());
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      forcedTheme={forcedTheme}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
