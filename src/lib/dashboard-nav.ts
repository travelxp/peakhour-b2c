import {
  Gauge,
  LayoutDashboard,
  Sparkles,
  FileText,
  TrendingUp,
  Plug,
  Settings,
  ListChecks,
  Zap,
  MessagesSquare,
  ShoppingBag,
  MapPin,
  LineChart,
  HardDrive,
  type LucideIcon,
} from "lucide-react";
import { ASK_ENABLED } from "@/lib/flags";
import { OUTCOMES_HOME, funnelNav } from "@/lib/nav-home";
import { GROWTH_HOME, activeSubHref, growthNav, type MandateState } from "@/lib/growth-v2-nav";
import { PILLAR_COPY, SUB_COPY, pillarLabel, subLabel } from "@/lib/nav-copy";

/**
 * The dashboard navigation as DATA. It used to live inside dashboard/layout.tsx
 * (a Next layout cannot export it), which left the sidebar, the pillar tabs, the
 * mobile bar and the tests each unable to see the same list. Nothing here renders:
 * a badge is named by key and the layout maps the key to a component.
 *
 * Labels and descriptions come from nav-copy.ts. Routes, the OUTCOMES_HOME
 * switch and the funnel partition are exactly what they were.
 */

export type NavBadgeKey = "running-jobs" | "open-tickets";

export interface NavSub {
  href: string;
  label: string;
  description?: string;
  matches?: string[];
  badge?: NavBadgeKey;
}

export interface NavItem {
  href: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  badge?: NavBadgeKey;
  /** cfg_features.key; unentitled orgs see the item locked. */
  feature?: string;
  /** Shown in the upgrade drawer when the gated pillar is rendered locked. */
  upsellTagline?: string;
  subItems?: NavSub[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// Autopilot Home ships dark: surfaced only outside production.
export const SHOW_AUTOPILOT = process.env.NEXT_PUBLIC_VERCEL_ENV !== "production";

const sub = (href: string, legacy: string, extra?: Partial<NavSub>): NavSub => ({
  href,
  label: subLabel(href, legacy),
  description: SUB_COPY[href]?.description,
  ...extra,
});

const pillar = (
  href: string,
  legacy: string,
  icon: LucideIcon,
  extra?: Partial<NavItem>,
): NavItem => ({
  href,
  label: pillarLabel(href, legacy),
  description: PILLAR_COPY[href]?.description,
  icon,
  ...extra,
});

/** Growth sub-items for a mandate state, in the copy's words. */
export function growthSubs(state: MandateState): NavSub[] {
  return growthNav(state).map((g) => sub(g.href, g.label, { matches: g.matches }));
}

/**
 * ★THE ORDER IS THE WEEK, NOT THE ORG CHART: Home → Connected accounts → Inbox →
 * Content → Growth → Commerce → Local presence → Reports, then the assistant,
 * the activity log, files, Peaks and Settings. (The long argument for this
 * order lived in the layout; it is unchanged.)
 */
export const PILLAR_NAV: NavGroup[] = [
  {
    label: "",
    items: [
      pillar("/dashboard/overview", "Overview", LayoutDashboard),
      pillar("/dashboard/integrations", "Integrations", Plug),
      pillar("/dashboard/inbox", "Inbox", MessagesSquare),
      pillar("/dashboard/content", "Content", FileText, {
        subItems: [
          ...(SHOW_AUTOPILOT ? [sub("/dashboard/content/autopilot", "Autopilot")] : []),
          sub("/dashboard/content", "Library"),
          sub("/dashboard/pages", "Pages"),
          sub("/dashboard/content/sources", "Sources"),
          sub("/dashboard/content/news", "News Desk"),
          sub("/dashboard/strategist", "Strategist"),
          sub("/dashboard/calendar", "Calendar"),
          sub("/dashboard/content/ledger", "Ledger"),
          sub("/dashboard/content/seasonal-events", "Seasonal Events"),
        ],
      }),
      pillar(GROWTH_HOME, "Growth", TrendingUp, { subItems: growthSubs("unknown") }),
      pillar("/dashboard/commerce", "Commerce", ShoppingBag, {
        feature: "commerce.nav",
        upsellTagline: "Autonomous merchandising, inventory and pricing across your storefronts.",
        subItems: [
          sub("/dashboard/commerce", "Command Center"),
          sub("/dashboard/commerce/channels", "Channels"),
          sub("/dashboard/commerce/autopilot", "Autopilot"),
          sub("/dashboard/commerce/catalog", "Catalog"),
          sub("/dashboard/commerce/inventory", "Inventory"),
          sub("/dashboard/commerce/pricing", "Pricing"),
          sub("/dashboard/commerce/reviews", "Reviews"),
          sub("/dashboard/commerce/assistant", "Assistant"),
          sub("/dashboard/commerce/knowledge", "Knowledge base"),
          sub("/dashboard/commerce/win-back", "Win back carts"),
          sub("/dashboard/commerce/broadcasts", "Broadcasts"),
        ],
      }),
      pillar("/dashboard/presence", "Presence", MapPin, {
        feature: "presence.nav",
        upsellTagline: "Own your Google Business Profile, listings and local reviews from one place.",
      }),
      pillar("/dashboard/insights/analytics", "Insights", LineChart, {
        subItems: [
          sub("/dashboard/insights/analytics", "Web Analytics"),
          sub("/dashboard/insights/search-console", "Search Console"),
        ],
      }),
      ...(ASK_ENABLED ? [pillar("/dashboard/ask", "Ask Peakhour", Sparkles)] : []),
      pillar("/dashboard/tasks", "Tasks", ListChecks, { badge: "running-jobs" }),
      pillar("/dashboard/drive", "Drive", HardDrive),
      pillar("/dashboard/peaks", "Peaks", Zap),
      pillar("/dashboard/settings", "Settings", Settings, {
        subItems: [
          sub("/dashboard/settings", "General"),
          sub("/dashboard/settings/preferences", "Preferences"),
          sub("/dashboard/settings/team", "Team"),
          sub("/dashboard/settings/whatsapp", "Peakhour on WhatsApp"),
          sub("/dashboard/settings/billing", "Billing"),
          sub("/dashboard/settings/tickets", "Tickets", { badge: "open-tickets" }),
        ],
      }),
    ],
  },
];

/** NOT `TrendingUp` (Growth's icon in the pillar list): the stub must not be mistaken for it. */
export const GROWTH_HOME_ITEM: NavItem = pillar(GROWTH_HOME, "Growth", Gauge);

/** The default is today's navigation: OUTCOMES_HOME is unset everywhere. */
export const NAV_GROUPS: NavGroup[] = OUTCOMES_HOME
  ? funnelNav(PILLAR_NAV, GROWTH_HOME_ITEM)
  : PILLAR_NAV;

/** Items with their Growth sub-items filled in for the current mandate state. */
export function navGroupsFor(state: MandateState): NavGroup[] {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.map((i) => (i.href === GROWTH_HOME ? { ...i, subItems: growthSubs(state) } : i)),
  }));
}

/** The multi-page pillar a pathname sits in, if any (drives PillarTabs). */
export function pillarForPath(pathname: string, groups: NavGroup[]): NavItem | undefined {
  return groups
    .flatMap((g) => g.items)
    .find((i) => i.subItems && i.subItems.length > 1 && activeSubHref(pathname, i.subItems) !== undefined);
}
