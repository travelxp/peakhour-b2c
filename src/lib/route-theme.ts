/**
 * Which theme a route may use.
 *
 * The public site (home, /shopify, the pillar pages, pricing, help, legal,
 * auth, share and claim pages) is always light. It is designed as a bright
 * page, and following the visitor's device setting made it dark for everyone
 * whose phone or laptop is in dark mode. The signed-in app (/dashboard and
 * /onboarding) keeps following the device setting.
 *
 * Returns the theme to force, or undefined to let next-themes follow the
 * system setting.
 */
const APP_PREFIXES = ["/dashboard", "/onboarding"] as const;

export function forcedThemeFor(pathname: string | null): "light" | undefined {
  if (!pathname) return "light";
  const inApp = APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return inApp ? undefined : "light";
}
