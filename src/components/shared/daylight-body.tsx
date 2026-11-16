"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { isAppRoute } from "@/lib/route-theme";
import { cn } from "@/lib/utils";

/**
 * The page `<body>`. Every public route is Daylight by default: `.theme-daylight` is put on the body itself (not a
 * wrapper div), so the portalled bits (the mobile menu, dialogs, toasts) inherit the tokens too, and so a page that
 * forgot to wrap itself never falls back to the old gold palette.
 *
 * The class is decided from the pathname, the same list the ThemeProvider uses (`isAppRoute`). A client component
 * renders it so the class is in the server HTML (no flash of the old theme) and follows soft navigations, which a
 * server-read request header could not: the root layout does not re-render when the visitor goes from /pricing to
 * /dashboard. /dashboard, /onboarding and /cms never get it and keep following the device theme.
 *
 * suppressHydrationWarning: under the coming-soon gate the server may see the rewritten path and the browser the
 * original one. React does not patch a mismatched attribute on hydration, so the effect below sets the class from the
 * browser's own path after mount; the gated page also wraps itself in Daylight, so nothing shows the wrong palette.
 */
export function DaylightBody({ className, children }: { className: string; children: ReactNode }) {
  const pathname = usePathname();
  const daylight = pathname ? !isAppRoute(pathname) : true;
  useEffect(() => {
    document.body.classList.toggle("theme-daylight", daylight);
  }, [daylight]);
  return (
    <body className={cn(className, daylight && "theme-daylight")} suppressHydrationWarning>
      {children}
    </body>
  );
}
