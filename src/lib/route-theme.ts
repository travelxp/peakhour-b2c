/**
 * Which routes are the signed-in app, and which theme a route may use.
 *
 * APP_PREFIXES is the one list of app routes. The middleware uses it for the
 * coming-soon session bypass, and the ThemeProvider uses it here.
 *
 * The public site (home, /shopify, the pillar pages, pricing, help, legal,
 * auth, share, claim and reconnect pages) is always light. It is designed as
 * a bright page, and following the visitor's device setting made it dark for
 * everyone whose phone or laptop is in dark mode. The signed-in app keeps
 * following the device setting.
 */
export const APP_PREFIXES = ["/dashboard", "/onboarding", "/cms"] as const;

export function isAppRoute(pathname: string): boolean {
  return APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** The theme to force, or undefined to let next-themes follow the device. */
export function forcedThemeFor(pathname: string | null): "light" | undefined {
  if (!pathname) return "light";
  return isAppRoute(pathname) ? undefined : "light";
}
