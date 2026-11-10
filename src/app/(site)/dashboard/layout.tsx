"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";

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
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { WorkspaceSwitcher } from "@/components/dashboard/workspace-switcher";
import { PeakhourMark } from "@/components/shared/peakhour-logo";
import { UserAvatar } from "@/components/dashboard/user-avatar";
import { PlanBadge } from "@/components/dashboard/plan-badge";
import { AttentionBell } from "@/components/dashboard/attention-bell";
import { TrialExpiryBanner } from "@/components/dashboard/trial-expiry-banner";
import { BalanceChip } from "@/components/dashboard/balance-chip";
import { CreditCapBanner } from "@/components/dashboard/credits-cap-banner";
import { CommandMenu } from "@/components/molecules/command-menu";
import { SidebarStorageMeter } from "@/components/dashboard/sidebar-storage-meter";
import { AskContextProvider } from "@/providers/ask-context-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { ASK_ENABLED } from "@/lib/flags";
import { useState } from "react";
import { HOME_ROUTE } from "@/lib/nav-home";
import { activeSubHref, mandateStateOf } from "@/lib/growth-v2-nav";
import { navGroupsFor, pillarForPath, type NavBadgeKey } from "@/lib/dashboard-nav";
import { PillarTabs } from "@/components/dashboard/pillar-tabs";
import { MobileTabBar } from "@/components/dashboard/mobile-tab-bar";
import { useGrowthV2Rules } from "@/lib/api/growth-v2";
import {
  Settings,
  LogOut,
  ChevronsUpDown,
  ArrowLeftRight,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useNavIntent } from "@/hooks/use-nav-intent";
import { useMyTickets } from "@/hooks/use-feedback";
import { useRunningJobCount } from "@/hooks/use-jobs";
import { LockedNavItem } from "@/components/dashboard/locked-nav-item";

// Client-only widgets that are not needed for first paint. Each is its own
// chunk, fetched after hydration, so the dashboard's shared first-load JS does
// not carry them (AI SDK, upload machinery, Stripe-adjacent dialogs). They
// render nothing until loaded, so layout does not shift.
const AddSpaceDialog = dynamic(
  () => import("@/components/media/add-space-dialog").then((m) => m.AddSpaceDialog),
  { ssr: false },
);
const UploadTrayHost = dynamic(
  () => import("@/components/drive/upload-tray").then((m) => m.UploadTrayHost),
  { ssr: false },
);
const FeedbackWidget = dynamic(
  () => import("@/components/molecules/feedback-widget").then((m) => m.FeedbackWidget),
  { ssr: false },
);
const ChatPanel = dynamic(
  () => import("@/components/molecules/chat-panel").then((m) => m.ChatPanel),
  { ssr: false },
);
const AskLauncher = dynamic(
  () => import("@/components/ask/ask-launcher").then((m) => m.AskLauncher),
  { ssr: false },
);

// The navigation itself (pillars, sub-links, their words) lives in
// @/lib/dashboard-nav and @/lib/nav-copy so the sidebar, the pillar tabs, the
// mobile bar and the tests read one list.

/**
 * A sidebar count that says what it is counting.
 *
 * ★A BARE NUMBER IN A NAV IS A RIDDLE. "Tasks · 3" does not say whether three
 * things are running, three have failed, or three are waiting on the reader —
 * and the difference between "working" and "broken" is the only thing the badge
 * is there to convey. Worse, the number was previously invisible to assistive
 * tech in any useful form: a screen reader announced "Tasks 3" and a truncated
 * "9+" announced "Tasks 9 plus".
 *
 * So the digit stays (it is a glanceable shape, which is the point of a badge)
 * and the sentence rides along in `title` for the pointer and in visually-hidden
 * text for the reader. The exact figure goes in both, because "9+" is a display
 * convenience and should never be the only number anyone can get.
 */
function NavCountBadge({ count, description }: { count: number; description: string }) {
  return (
    <span className="ml-auto flex items-center" title={description}>
      <span
        aria-hidden
        className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground"
      >
        {count > 9 ? "9+" : count}
      </span>
      <span className="sr-only">{description}</span>
    </span>
  );
}

/** Badge showing count of open tickets — fetches lazily */
function OpenTicketBadge() {
  const { data: tickets } = useMyTickets();
  const openCount = tickets?.filter(
    (t) => t.status !== "resolved" && t.status !== "closed"
  ).length;
  if (!openCount) return null;
  return (
    <NavCountBadge
      count={openCount}
      description={`${openCount} support ${openCount === 1 ? "ticket" : "tickets"} still open — open Tickets to read the replies`}
    />
  );
}

/** Badge showing count of running/pending background jobs for this business */
function RunningJobsBadge() {
  const count = useRunningJobCount();
  if (!count) return null;
  return (
    <NavCountBadge
      count={count}
      description={`${count} ${count === 1 ? "job is" : "jobs are"} running for you right now — open Activity to watch progress. Nothing is waiting on you.`}
    />
  );
}

const NAV_BADGES: Record<NavBadgeKey, () => React.ReactNode> = {
  "running-jobs": () => <RunningJobsBadge />,
  "open-tickets": () => <OpenTicketBadge />,
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}

/**
 * First-paint structure while auth resolves: sidebar rail, header bar and
 * content blocks, so the screen is never blank and nothing jumps when the
 * real shell mounts (same 14-rem-ish rail, h-14 header, p-6 content inset).
 */
function DashboardShellSkeleton() {
  return (
    <div
      className="flex h-svh w-full"
      role="status"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <aside className="hidden w-64 shrink-0 flex-col gap-4 border-r p-3 md:flex">
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-9 w-full" />
        <div className="space-y-2 pt-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
        <Skeleton className="mt-auto h-12 w-full" />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <Skeleton className="size-7 rounded-md" />
          <div className="ml-auto flex items-center gap-3">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="size-7 rounded-full" />
          </div>
        </header>
        {/* The one main landmark while auth resolves (the real shell's is SidebarInset). */}
        <main className="space-y-6 p-4 md:p-6">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-24 w-full" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </main>
      </div>
    </div>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, org, logout, isLoading, isAuthenticated, entitlements } = useAuth();
  // Whether a mandate exists decides whether Growth shows First run. The same
  // query feeds the Rules screen, so this is one request, not two.
  const rules = useGrowthV2Rules();
  // Hover/focus/touch on a nav link warms its route code and first query; the
  // links are prefetch={false} so ~40 of them do not prefetch on every load.
  const intentProps = useNavIntent();
  const mandateState = mandateStateOf(rules.data);
  const navGroups = navGroupsFor(mandateState);
  // Which pillars the reader has opened or closed by hand. Unset = follow the
  // route: the pillar you are in is open, the rest are collapsed, so the first
  // view is the pillars, not every sub-link of every pillar.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  if (isLoading) {
    return <DashboardShellSkeleton />;
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

  // The multi-page pillar the reader is in gets in-page tabs, so its sub-pages
  // are reachable without opening the sidebar (essential on a phone). A gated
  // pillar the org is not entitled to has no sub-pages to show.
  const inPillar = pillarForPath(pathname ?? "", navGroups);
  const pillarTabs =
    inPillar && (!inPillar.feature || entitlements?.features?.includes(inPillar.feature)) ? inPillar : undefined;

  // Initials are no longer derived here: <UserAvatar> resolves the user's
  // chosen avatar (which may be an illustrated character, not a monogram at
  // all) and falls back to initials from @/lib/avatars — where the derivation
  // splits on astral characters properly, which this one did not.

  return (
    <AskContextProvider>
    {/* `h-svh` is load-bearing, and it is what makes the `overflow-auto`
        further down actually mean something. SidebarProvider ships
        `min-h-svh` — a MINIMUM, so the wrapper grows with its content and the
        shell has never had a definite height. A `flex: 1 1 0%` item still
        contributes its max-content flex fraction to the container's intrinsic
        size (Flexbox §9.9.1), so the content area below stretched with the
        page, its `overflow-auto` never engaged, and the document scrolled
        instead. That is also why /dashboard/ask's `calc()` was the only thing
        holding it in: percentage/flex heights had nothing definite to resolve
        against.

        Scoped here rather than in components/ui/sidebar.tsx because /cms
        shares that primitive and should keep document scrolling for now.
        Net effect: the header row stays put while the page scrolls under it.
        (No `min-h-0` needed on SidebarInset — it is a flex item in a ROW
        container, and automatic minimum size only applies on the main axis,
        so its cross-axis `min-height: auto` already resolves to 0.)

        `svh` not `dvh`: the small viewport height is the one that assumes
        mobile browser chrome is fully EXPANDED, so the shell can never be
        taller than what is actually visible — worst case it leaves a strip
        at the bottom once the URL bar retracts, where `dvh` would instead
        resize the scroll container mid-scroll. It also matches the unit
        SidebarProvider already chose for its `min-h-`.

        Radix's scroll lock still holds: react-remove-scroll blocks wheel and
        touchmove outside the modal subtree rather than relying only on
        `body { overflow: hidden }`, so moving the scroller off the document
        does not let the background scroll behind a Dialog or Sheet. */}
    <SidebarProvider className="h-svh">
      {/* The ONE "Add space" dialog: opened by the storage meter and by a 402 on an upload, on any dashboard page. */}
      <AddSpaceDialog />
      <Sidebar collapsible="icon" variant="sidebar">
        {/* ── Header: brand block + workspace ────────────────── */}
        {/* ★MARK IN ONE COLUMN, NAME OVER DESCRIPTION IN THE OTHER — the shape
            the shell always had, finally with the real artwork in it. It shipped
            for a long time as a hand-rolled "P" square labelled "Peakhour / AI
            Marketing" while the marketing header two clicks away used the actual
            mark.

            ⚠️AND THE NAME IS TEXT, NOT THE WORDMARK IMAGE. An intermediate
            version put `PeakhourLogo` here, which drew the mark TWICE:
            `peakhour-logo.png` is the full lockup — mark AND wordmark — so it
            already contains what sits beside it. Cropping an image would not
            fix that; using type does, and it buys the things an image cannot:
            it scales with the reader's font settings, recolours per theme with
            no `dark:invert` hack, and truncates. The PNG stays on the marketing
            header and footer, where it IS the whole lockup and nothing is
            next to it.

            ★The disc is its own asset rather than the lockup scaled down,
            because they are different artwork: the lockup draws the mark as
            outline strokes — legible at 32px inside a 200px lockup, a grey
            smudge once it is the only thing in a 32px box — and the disc is the
            solid cut that survives rail size. It is the one element present in
            BOTH states, which is why it is not duplicated by anything.

            🚫THE DESCRIPTOR IS A DESCRIPTOR, NOT A SLOGAN, and the slot decides
            that. It is on screen every visit, and a brand line at that
            frequency stops registering inside a fortnight — so its job is to
            say what the product IS to someone who does not know yet. "Every
            hour is Peakhour" is the better LINE, and it lives on the onboarding
            payoff where it is read once and something has just been achieved.

            "AI Marketing" was too narrow for the job: Commerce, Presence, Inbox
            and Insights are all shipped pillars, and a nav promising marketing
            while listing a storefront undersells itself in its own chrome.

            ⚠️LENGTH IS A HARD CONSTRAINT HERE, not a preference. An earlier
            attempt used a 39-character positioning statement, which ran past
            the rail and truncated to "Your Smart Autonomous Bus…". The text
            column is about 224px — roughly 40 characters at 11px with ZERO
            margin — so anything near that breaks on a larger OS font, a
            narrower rail or a translation. */}
        <SidebarHeader className="gap-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="hover:bg-transparent">
                <Link href={HOME_ROUTE} prefetch={false} {...intentProps(HOME_ROUTE)}>
                  {/* ★TWO COLUMNS: THE MARK, THEN THE NAME OVER ITS DESCRIPTION.
                      The mark is present in BOTH states — it is the one element
                      that survives the collapse — so it is not duplicated the
                      way the lockup duplicated it. */}
                  <PeakhourMark className="size-8 shrink-0 group-data-[collapsible=icon]:size-6" />
                  <span className="grid min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    {/* ★SET AS TEXT, NOT THE WORDMARK PNG. The lockup image
                        carries the mark inside it, so pairing it with the mark
                        drew the mark twice — and cropping an image is not a fix.
                        Live text also scales with the reader's font settings,
                        recolours per theme without a `dark:invert` hack, and can
                        be truncated. The wordmark PNG stays where it belongs:
                        the marketing header, where it IS the whole lockup and
                        nothing sits beside it. */}
                    <span className="truncate text-base font-semibold leading-tight">
                      Peakhour.ai
                    </span>
                    <span className="truncate text-xs leading-tight text-muted-foreground">
                      Your AI business engine.
                    </span>
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="group-data-[collapsible=icon]:hidden">
            <WorkspaceSwitcher />
          </div>
        </SidebarHeader>

        {/* ── Navigation ────────────────────────────────────── */}
        <SidebarContent>
          {navGroups.map((group, idx) => (
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
                          description={item.description}
                          featureKey={item.feature}
                          tagline={item.upsellTagline}
                        />
                      );
                    }
                    const Icon = item.icon;
                    const isActive = item.subItems
                      ? activeSubHref(pathname ?? "", item.subItems) !== undefined
                      : pathname === item.href || pathname?.startsWith(item.href + "/");

                    if (item.subItems) {
                      return (
                        <Collapsible
                          key={item.href}
                          asChild
                          open={toggled[item.href] ?? isActive}
                          onOpenChange={(o) => setToggled((t) => ({ ...t, [item.href]: o }))}
                          className="group/collapsible"
                        >
                          <SidebarMenuItem>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton
                                tooltip={item.description ? `${item.label}: ${item.description}` : item.label}
                                isActive={isActive}
                              >
                                <Icon />
                                <span>{item.label}</span>
                                <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <SidebarMenuSub>
                                {item.subItems.map((sub) => {
                                  // Exactly one sub-item is lit: the one with the
                                  // longest matching prefix (its href or its
                                  // `matches`). On /dashboard/settings/team that is
                                  // "Team", not "General" (href /dashboard/settings),
                                  // and on /dashboard/growth/rules/audiences it is
                                  // "Rules", not "Growth home".
                                  const subActive = activeSubHref(pathname ?? "", item.subItems!) === sub.href;
                                  return (
                                    <SidebarMenuSubItem key={sub.href}>
                                      <SidebarMenuSubButton asChild isActive={subActive}>
                                        <Link href={sub.href} prefetch={false} {...intentProps(sub.href)} title={sub.description}>
                                          <span>{sub.label}</span>
                                          {sub.badge && NAV_BADGES[sub.badge]()}
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
                          tooltip={item.description ? `${item.label}: ${item.description}` : item.label}
                        >
                          <Link href={item.href} prefetch={false} {...intentProps(item.href)} title={item.description}>
                            <Icon />
                            <span>{item.label}</span>
                            {item.badge && NAV_BADGES[item.badge]()}
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
                    <UserAvatar className="size-8" glyphClassName="text-xs" />
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
                    <UserAvatar className="size-8" glyphClassName="text-xs" />
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
      <UploadTrayHost />

      {/* ── Main Content ──────────────────────────────────── */}
      <SidebarInset className="min-w-0">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          {/* From md up the four chips sit in the header. Below it they would
              crowd a 375px bar (a plan badge alone is up to 10rem), so one
              button opens them as a strip under the header instead. */}
          <div className="ml-auto hidden items-center gap-3 md:flex">
            <BalanceChip />
            <PlanBadge />
            <AttentionBell />
            <FeedbackWidget />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto size-8 md:hidden"
            aria-expanded={headerMenuOpen}
            aria-controls="header-overflow"
            onClick={() => setHeaderMenuOpen((o) => !o)}
          >
            <MoreHorizontal className="size-4" aria-hidden />
            <span className="sr-only">{headerMenuOpen ? "Hide balance, plan and alerts" : "Show balance, plan and alerts"}</span>
          </Button>
        </header>
        {headerMenuOpen && (
          <div id="header-overflow" className="flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-2 md:hidden">
            <BalanceChip />
            <PlanBadge />
            <AttentionBell />
            <FeedbackWidget />
          </div>
        )}
        {/* The shell is the SINGLE owner of dashboard page padding — routes
            must not re-declare `p-*` on their root (see
            @/components/dashboard/page-shell). Steps down to 16px on mobile:
            at 375px a flat 24px inset costs 13% of the screen width before a
            card's own 24px padding is even applied. */}
        {/* This is the app's scroll container (see the `h-svh` note above).
            `flex flex-col` so a route can opt into filling the viewport
            (<PageShell fill>) without hard-coding what the chrome costs —
            which is 104px here (header 56 + this padding 48; the banner slot
            contributes 0 in the common case because it is `empty:hidden`).

            Ordinary pages are unaffected by the flex change: a block child of
            a column flex container keeps `min-height: auto`, whose automatic
            minimum size is its content height, so nothing shrinks below its
            content and long pages scroll here rather than being squashed.

            `scroll-pt-*` is required, not decoration. Next's
            ScrollAndFocusHandler tries `document.documentElement.scrollTop = 0`
            on navigation and falls back to `scrollIntoView()` when that does
            not move anything — and now that the document does not scroll, it
            ALWAYS falls back. `scrollIntoView` aligns to the scrollport's
            padding-box edge, so without a matching scroll-padding every
            sidebar navigation from a scrolled position parked the page's
            first element flush against the header, eating this inset. */}
        <div className="flex min-w-0 flex-1 flex-col overflow-auto p-4 scroll-pt-4 sm:p-6 sm:scroll-pt-6" data-slot="dashboard-scroll">
          {/* Banner slot — sits above the route content. Trial-expiry shows
              only inside the final 3 days of a trial; the credit-cap banner
              only once usage crosses its cap. Both render nothing otherwise
              (no trial, plenty of days left, unlimited, dismissed).

              `empty:hidden` matters: both children return null in the common
              case, but the wrapper's own margin still applied, pushing every
              page in the app down 16px for a band that rendered nothing.
              (`:empty` ignores comment nodes, so React's null renders match.
              It is NOT relaxed about whitespace in any shipping browser
              though — adding a bare string or `{" "}` between these children
              silently brings the dead 16px back.)

              On the `mx-auto max-w-360` cap — be precise about what it does,
              because it is easy to overstate. It does NOT centre-align the
              banner with the content: an `mx-auto` block and a full-width
              block already share a centre axis, so that was never the
              problem. What it does is stop the banner running WIDER than the
              widest <PageShell> tier (max-w-360 here == `wide` there, keep
              them in sync). That only binds past a ~1744px viewport with the
              sidebar expanded, so on a 1280 or 1440 monitor this is a no-op —
              it is ultrawide insurance, nothing more. A banner still has no
              shared left edge with a `narrow` (768px) or `standard` (1152px)
              page. The real fix is to move this slot inside PageShell so it
              inherits that page's own measure, which is only possible once
              every route has been migrated onto it. */}
          <div className="mx-auto mb-4 flex w-full max-w-360 flex-col gap-2 empty:hidden sm:mb-6">
            <TrialExpiryBanner />
            <CreditCapBanner />
          </div>
          {pillarTabs && (
            <PillarTabs
              tabs={pillarTabs.subItems ?? []}
              pathname={pathname ?? ""}
              label={pillarTabs.label}
              intentProps={intentProps}
            />
          )}
          {children}
          {/* Room for the fixed bottom bar (h-14 plus the home-indicator inset)
              AND the Ask button that floats above it (bottom 4.5rem + h-12 =
              7.5rem). Scrolled to the end, the last card's actions clear both. */}
          <div aria-hidden className="h-[calc(8rem+env(safe-area-inset-bottom))] shrink-0 md:hidden" />
        </div>
      </SidebarInset>

      <MobileTabBar
        pathname={pathname ?? ""}
        hasCommerce={!!entitlements?.features?.includes("commerce.nav")}
        intentProps={intentProps}
      />

      {/* ── AI Chat FAB ──────────────────────────────────── */}
      {/* Ask Peakhour (grounded) runs behind a flag; legacy ChatPanel until PR-11 cutover. */}
      {ASK_ENABLED ? <AskLauncher /> : <ChatPanel />}
    </SidebarProvider>
    </AskContextProvider>
  );
}
