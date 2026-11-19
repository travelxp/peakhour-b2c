import { GROWTH_HOME } from "@/lib/growth-v2-nav";

export interface MobileTab {
  key: "home" | "studio" | "inbox" | "content" | "growth" | "commerce";
  href: string;
  /** Key into PILLAR_COPY for the label and tooltip. */
  copyHref: string;
  /** Pathname prefixes that light this tab. */
  prefixes: string[];
}

/**
 * The bar's destinations before "More": Home, Studio (only for an org entitled
 * to it, UX spec U3), Inbox, Content, then Commerce for an org entitled to it
 * or Growth for everyone else. Growth stays one tap away under More for
 * Commerce orgs. An org without Studio gets exactly the bar it had.
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
    ? { key: "commerce", href: "/dashboard/commerce", copyHref: "/dashboard/commerce", prefixes: ["/dashboard/commerce"] }
    : { key: "growth", href: GROWTH_HOME, copyHref: "/dashboard/growth", prefixes: [GROWTH_HOME, "/dashboard/ads"] };
  const studio: MobileTab = {
    key: "studio",
    href: "/dashboard/studio",
    copyHref: "/dashboard/studio",
    prefixes: ["/dashboard/studio"],
  };
  return [
    home,
    ...(hasStudio ? [studio] : []),
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
