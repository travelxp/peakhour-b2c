import { GROWTH_HOME } from "@/lib/growth-v2-nav";

/** What "Commerce" reads as when Studio shares the bar: six cells are 60px each at 360px and the full word does not fit. */
export const COMMERCE_SHORT_LABEL = "Shop";

export interface MobileTab {
  key: "home" | "studio" | "inbox" | "content" | "growth" | "commerce";
  href: string;
  /** Key into PILLAR_COPY for the label and tooltip. */
  copyHref: string;
  /** A shorter label for a crowded bar, used instead of the nav copy's. */
  shortLabel?: string;
  /** Pathname prefixes that light this tab. */
  prefixes: string[];
}

/**
 * The bar's destinations before "More": Home, Studio (only for an org entitled
 * to it, UX spec U3), Inbox, Content, then Commerce for an org entitled to it
 * or Growth for everyone else. Growth stays one tap away under More for
 * Commerce orgs. An org without Studio gets exactly the bar it had.
 *
 * ★SIX CELLS (UX spec U3; CS-UI-1 measured Chrome with Geist at 360px: 60px a cell, the app's 12px type floor). "Commerce" is 61px of text, so
 * with Studio AND Commerce it takes the short label "Shop" (the other labels, "Content" at 45px the widest, fit). Inbox stays in the bar in
 * every combination; an earlier cut moved it into More for that one, which hid the merchant's replies.
 */
export function primaryTabs({
  hasCommerce,
  hasStudio = false,
  homeHref,
}: {
  hasCommerce: boolean;
  hasStudio?: boolean;
  homeHref: string;
}): MobileTab[] {
  const home: MobileTab = {
    key: "home",
    href: homeHref,
    copyHref: "/dashboard/overview",
    prefixes: [homeHref],
  };
  const fourth: MobileTab = hasCommerce
    ? {
        key: "commerce",
        href: "/dashboard/commerce",
        copyHref: "/dashboard/commerce",
        ...(hasStudio ? { shortLabel: COMMERCE_SHORT_LABEL } : {}),
        prefixes: ["/dashboard/commerce"],
      }
    : { key: "growth", href: GROWTH_HOME, copyHref: "/dashboard/growth", prefixes: [GROWTH_HOME, "/dashboard/ads"] };
  const studio: MobileTab = {
    key: "studio",
    href: "/dashboard/studio",
    copyHref: "/dashboard/studio",
    prefixes: ["/dashboard/studio"],
  };
  const inbox: MobileTab = { key: "inbox", href: "/dashboard/inbox", copyHref: "/dashboard/inbox", prefixes: ["/dashboard/inbox"] };
  return [
    home,
    ...(hasStudio ? [studio] : []),
    inbox,
    {
      key: "content",
      href: "/dashboard/content",
      copyHref: "/dashboard/content",
      prefixes: ["/dashboard/content", "/dashboard/pages", "/dashboard/strategist", "/dashboard/calendar"],
    },
    fourth,
  ];
}

const under = (p: string, prefix: string) => p === prefix || p.startsWith(prefix + "/");

export function isTabActive(pathname: string, tab: MobileTab): boolean {
  return tab.prefixes.some((p) => under(pathname, p));
}
