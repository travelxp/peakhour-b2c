import { GROWTH_HOME } from "@/lib/growth-v2-nav";

export interface MobileTab {
  key: "home" | "inbox" | "content" | "growth" | "commerce";
  href: string;
  /** Key into PILLAR_COPY for the label and tooltip. */
  copyHref: string;
  /** Pathname prefixes that light this tab. */
  prefixes: string[];
}

/**
 * The bar's destinations before "More": Home, Inbox, Content, then Commerce for
 * an org entitled to it or Growth for everyone else. Growth stays one tap away
 * under More for Commerce orgs.
 */
export function primaryTabs({ hasCommerce, homeHref }: { hasCommerce: boolean; homeHref: string }): MobileTab[] {
  const home: MobileTab = {
    key: "home",
    href: homeHref,
    copyHref: "/dashboard/overview",
    prefixes: [homeHref],
  };
  const fourth: MobileTab = hasCommerce
    ? { key: "commerce", href: "/dashboard/commerce", copyHref: "/dashboard/commerce", prefixes: ["/dashboard/commerce"] }
    : { key: "growth", href: GROWTH_HOME, copyHref: "/dashboard/growth", prefixes: [GROWTH_HOME, "/dashboard/ads"] };
  return [
    home,
    { key: "inbox", href: "/dashboard/inbox", copyHref: "/dashboard/inbox", prefixes: ["/dashboard/inbox"] },
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
