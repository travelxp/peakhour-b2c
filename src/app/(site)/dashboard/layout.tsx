"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { OrgSwitcher } from "@/components/dashboard/org-switcher";
import { BusinessSwitcher } from "@/components/dashboard/business-switcher";
import { PlanBadge } from "@/components/dashboard/plan-badge";
import { AttentionBell } from "@/components/dashboard/attention-bell";
import { TrialExpiryBanner } from "@/components/dashboard/trial-expiry-banner";
import { BalanceChip } from "@/components/dashboard/balance-chip";
import { CreditCapBanner } from "@/components/dashboard/credits-cap-banner";
import { CommandMenu } from "@/components/molecules/command-menu";
import { SidebarStorageMeter } from "@/components/dashboard/sidebar-storage-meter";
import { FeedbackWidget } from "@/components/molecules/feedback-widget";
import { ChatPanel } from "@/components/molecules/chat-panel";
import { AskContextProvider } from "@/providers/ask-context-provider";
import { AskLauncher } from "@/components/ask/ask-launcher";
import { ASK_ENABLED } from "@/lib/flags";
import {
  LayoutDashboard,
  Sparkles,
  FileText,
  TrendingUp,
  Plug,
  Settings,
  LogOut,
  ChevronsUpDown,
  ArrowLeftRight,
  ChevronRight,
  ListChecks,
  Zap,
  MessagesSquare,
  ShoppingBag,
  MapPin,
  LineChart,
  type LucideIcon,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useMyTickets } from "@/hooks/use-feedback";
import { useRunningJobCount } from "@/hooks/use-jobs";
import { LockedNavItem } from "@/components/dashboard/locked-nav-item";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: () => React.ReactNode;
  /**
   * Optional entitlement gate (a cfg_features.key). When set, the item renders
   * only if the key is present in the org's entitlements snapshot — the same
   * check `useFeature` runs. Absent = always visible (the default for the core
   * Content/Growth items). Used to gate the Commerce pillar on `commerce.nav`.
   */
  feature?: string;
  /**
   * One-line value prop shown in the upgrade drawer when a `feature`-gated
   * pillar is rendered locked (unentitled) instead of hidden. Ignored for
   * ungated items. See LockedNavItem.
   */
  upsellTagline?: string;
  subItems?: { href: string; label: string; badge?: () => React.ReactNode }[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Autopilot Home ships dark: surfaced only in non-prod (mirrors the
// content.autopilot_home feature's in_development state) so it can run
// side-by-side with Library for comparison before launch. NEXT_PUBLIC_*
// is build-inlined, so this static const is safe at module scope. The
// page route enforces the same gate server-trip-free via a redirect.
const SHOW_AUTOPILOT = process.env.NEXT_PUBLIC_VERCEL_ENV !== "production";

const NAV_GROUPS: NavGroup[] = [
  {
    label: "",
    items: [
      { href: "/dashboard/overview", label: "Overview", icon: LayoutDashboard },
      ...(ASK_ENABLED
        ? [{ href: "/dashboard/ask", label: "Ask Peakhour", icon: Sparkles }]
        : []),
      {
        href: "/dashboard/content",
        label: "Content",
        icon: FileText,
        // Order encodes the mental model: Library → Sources → Strategist
        // → Calendar → Seasonal Events = ingest → ground → plan →
        // publish → background calendar. Seasonal events sit at the
        // end because they're a long-tail config the strategist + the
        // supervisor's seasonal generator stream consume — most
        // owners visit them rarely. Per the LinkedIn 360 plan §3.3 IA
        // decision (with the Seasonal Events addition).
        subItems: [
          // Autopilot leads the mental model: status → act, then the
          // existing ingest → ground → plan → publish chain below.
          ...(SHOW_AUTOPILOT
            ? [{ href: "/dashboard/content/autopilot", label: "Autopilot" }]
            : []),
          { href: "/dashboard/content", label: "Library" },
          { href: "/dashboard/content/sources", label: "Sources" },
          { href: "/dashboard/content/news", label: "News Desk" },
          { href: "/dashboard/strategist", label: "Strategist" },
          { href: "/dashboard/calendar", label: "Calendar" },
          { href: "/dashboard/media", label: "Media" },
          { href: "/dashboard/content/seasonal-events", label: "Seasonal Events" },
        ],
      },
      {
        href: "/dashboard/ads",
        label: "Growth",
        icon: TrendingUp,
        subItems: [
          { href: "/dashboard/ads", label: "Ads" },
          { href: "/dashboard/outcomes", label: "Outcomes" },
          { href: "/dashboard/optimizer", label: "Optimizer" },
        ],
      },
      // Commerce — the third pillar. Gated on `commerce.nav` (granted to every
      // plan bundling a Commerce product; migration 144), so only Commerce
      // customers carry the extra sidebar weight. Sub-items are added as each
      // surface ships — Command Center (outcomes home), Assistant + Inventory
      // exist today; Autopilot and Channels land in later Phase-0 PRs.
      {
        href: "/dashboard/commerce",
        label: "Commerce",
        icon: ShoppingBag,
        feature: "commerce.nav",
        upsellTagline:
          "Autonomous merchandising, inventory and pricing across your storefronts.",
        subItems: [
          { href: "/dashboard/commerce", label: "Command Center" },
          { href: "/dashboard/commerce/channels", label: "Channels" },
          { href: "/dashboard/commerce/autopilot", label: "Autopilot" },
          { href: "/dashboard/commerce/catalog", label: "Catalog" },
          { href: "/dashboard/commerce/inventory", label: "Inventory" },
          { href: "/dashboard/commerce/pricing", label: "Pricing" },
          { href: "/dashboard/commerce/reviews", label: "Reviews" },
          { href: "/dashboard/commerce/assistant", label: "Assistant" },
        ],
      },
      // Presence — the local-presence pillar (Google Business Profile anchor).
      // Gated on `presence.nav` (granted free to every plan that bundles the
      // Presence product). Surfaces render coming_soon until Google API access
      // lands; the pillar is visible so owners can find it.
      {
        href: "/dashboard/presence",
        label: "Presence",
        icon: MapPin,
        feature: "presence.nav",
        upsellTagline:
          "Own your Google Business Profile, listings and local reviews from one place.",
      },
      // Insights — GA4 + Search Console dashboards. Ungated (no `feature`):
      // the pages self-gate on the relevant Google integration being
      // connected, so the pillar stays discoverable for everyone and acts
      // as the connect prompt. Previously these routes existed but were
      // unreachable from the nav — only deep-linked from the Overview
      // recommendations card / Ask Peakhour.
      {
        href: "/dashboard/insights/analytics",
        label: "Insights",
        icon: LineChart,
        subItems: [
          { href: "/dashboard/insights/analytics", label: "Web Analytics" },
          { href: "/dashboard/insights/search-console", label: "Search Console" },
        ],
      },
      { href: "/dashboard/inbox", label: "Inbox", icon: MessagesSquare },
      { href: "/dashboard/tasks", label: "Tasks", icon: ListChecks, badge: () => <RunningJobsBadge /> },
      { href: "/dashboard/integrations", label: "Integrations", icon: Plug },
      { href: "/dashboard/peaks", label: "Peaks", icon: Zap },
      {
        href: "/dashboard/settings",
        label: "Settings",
        icon: Settings,
        subItems: [
          { href: "/dashboard/settings", label: "General" },
          { href: "/dashboard/settings/preferences", label: "Preferences" },
          { href: "/dashboard/settings/team", label: "Team" },
          { href: "/dashboard/settings/billing", label: "Billing" },
          { href: "/dashboard/settings/tickets", label: "Tickets", badge: () => <OpenTicketBadge /> },
        ],
      },
    ],
  },
];

/** Badge showing count of open tickets — fetches lazily */
function OpenTicketBadge() {
  const { data: tickets } = useMyTickets();
  const openCount = tickets?.filter(
    (t) => t.status !== "resolved" && t.status !== "closed"
  ).length;
  if (!openCount) return null;
  return (
    <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
      {openCount > 9 ? "9+" : openCount}
    </span>
  );
}

/** Badge showing count of running/pending background jobs for this business */
function RunningJobsBadge() {
  const count = useRunningJobCount();
  if (!count) return null;
  return (
    <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, org, logout, isLoading, isAuthenticated, entitlements } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Please sign in to continue.
          </p>
          <Button asChild>
            <Link href="/auth">Sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  const initials = user?.name
    ? user.name
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : user?.email?.[0]?.toUpperCase() || "?";

  return (
    <AskContextProvider>
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="sidebar">
        {/* ── Header: Logo + Switchers ──────────────────────── */}
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/dashboard/overview">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <span className="text-sm font-bold">P</span>
                  </div>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-semibold">
                      Peakhour
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      AI Marketing
                    </span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="group-data-[collapsible=icon]:hidden">
            <OrgSwitcher />
            <BusinessSwitcher />
          </div>
        </SidebarHeader>

        <SidebarSeparator />

        {/* ── Navigation ────────────────────────────────────── */}
        <SidebarContent>
          {NAV_GROUPS.map((group, idx) => (
            <SidebarGroup key={group.label || `group-${idx}`}>
              {group.label && (
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    // Gated pillar the org isn't entitled to → render it
                    // locked with an upsell affordance instead of hiding it
                    // (entitlements are resolved by now; the shell blocks on
                    // isLoading above, so no locked-flash for entitled orgs).
                    if (
                      item.feature &&
                      !entitlements?.features?.includes(item.feature)
                    ) {
                      return (
                        <LockedNavItem
                          key={item.href}
                          icon={item.icon}
                          label={item.label}
                          featureKey={item.feature}
                          tagline={item.upsellTagline}
                        />
                      );
                    }
                    const Icon = item.icon;
                    const isActive = item.subItems
                      ? item.subItems.some((s) => pathname === s.href || pathname?.startsWith(s.href + "/"))
                      : pathname === item.href || pathname?.startsWith(item.href + "/");

                    if (item.subItems) {
                      return (
                        <Collapsible key={item.href} asChild defaultOpen={isActive} className="group/collapsible">
                          <SidebarMenuItem>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton tooltip={item.label} isActive={isActive}>
                                <Icon />
                                <span>{item.label}</span>
                                <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <SidebarMenuSub>
                                {item.subItems.map((sub) => {
                                  // Active when URL exactly matches OR is
                                  // nested under sub.href, but only when no
                                  // sibling sub-item has a more-specific
                                  // match. Example: on /dashboard/settings/team
                                  // we want only "Team" lit, not "General"
                                  // (which has href /dashboard/settings).
                                  const matches =
                                    pathname === sub.href ||
                                    pathname.startsWith(sub.href + "/");
                                  const hasMoreSpecificSibling = item.subItems!.some(
                                    (other) =>
                                      other.href !== sub.href &&
                                      other.href.length > sub.href.length &&
                                      (pathname === other.href ||
                                        pathname.startsWith(other.href + "/")),
                                  );
                                  const subActive = matches && !hasMoreSpecificSibling;
                                  return (
                                    <SidebarMenuSubItem key={sub.href}>
                                      <SidebarMenuSubButton asChild isActive={subActive}>
                                        <Link href={sub.href}>
                                          <span>{sub.label}</span>
                                          {sub.badge?.()}
                                        </Link>
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                  );
                                })}
                              </SidebarMenuSub>
                            </CollapsibleContent>
                          </SidebarMenuItem>
                        </Collapsible>
                      );
                    }

                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.label}
                        >
                          <Link href={item.href}>
                            <Icon />
                            <span>{item.label}</span>
                            {item.badge?.()}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        {/* ── Footer: Storage meter + User ──────────────────── */}
        <SidebarFooter>
          <SidebarStorageMeter />
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left leading-tight">
                      <span className="truncate text-sm font-medium">
                        {user?.name || "User"}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user?.email}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="bottom"
                  align="end"
                  sideOffset={4}
                >
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left leading-tight">
                      <span className="truncate text-sm font-semibold">
                        {user?.name || "User"}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {org?.name}
                      </span>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/settings">
                      <Settings className="mr-2 size-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  {user?.cmsUser && (
                    <DropdownMenuItem asChild>
                      <Link href="/cms/overview">
                        <ArrowLeftRight className="mr-2 size-4" />
                        Switch to CMS
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logout()}>
                    <LogOut className="mr-2 size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      {/* ── Cmd+K Command Menu ─────────────────────────────── */}
      <CommandMenu />

      {/* ── Main Content ──────────────────────────────────── */}
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="ml-auto flex items-center gap-3">
            <BalanceChip />
            <PlanBadge />
            <AttentionBell />
            <FeedbackWidget />
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6">
          {/* Trial-expiry warning slot — sits above the route content
              only when a trial is within the final 3 days. Component
              renders nothing in all other states (no trial, plenty of
              days left, dismissed). */}
          <div className="mb-4 flex flex-col gap-2">
            <TrialExpiryBanner />
            <CreditCapBanner />
          </div>
          {children}
        </div>
      </SidebarInset>

      {/* ── AI Chat FAB ──────────────────────────────────── */}
      {/* Ask Peakhour (grounded) runs behind a flag; legacy ChatPanel until PR-11 cutover. */}
      {ASK_ENABLED ? <AskLauncher /> : <ChatPanel />}
    </SidebarProvider>
    </AskContextProvider>
  );
}
