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
import { CommandMenu } from "@/components/molecules/command-menu";
import { FeedbackWidget } from "@/components/molecules/feedback-widget";
import {
  LayoutDashboard,
  FileText,
  Megaphone,
  TrendingUp,
  Sparkles,
  Brain,
  Calendar,
  Plug,
  Settings,
  LogOut,
  ChevronsUpDown,
  ArrowLeftRight,
  ChevronRight,
  TicketCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useMyTickets } from "@/hooks/use-feedback";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  subItems?: { href: string; label: string; badge?: () => React.ReactNode }[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "",
    items: [
      { href: "/dashboard/overview", label: "Overview", icon: LayoutDashboard },
      {
        href: "/dashboard/content",
        label: "Content",
        icon: FileText,
        subItems: [
          { href: "/dashboard/content", label: "Library" },
          { href: "/dashboard/strategist", label: "Strategist" },
          { href: "/dashboard/calendar", label: "Calendar" },
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
      { href: "/dashboard/integrations", label: "Integrations", icon: Plug },
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, org, logout, isLoading, isAuthenticated } = useAuth();

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
                      PeakHour
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
                                  const subActive = pathname === sub.href;
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

        {/* ── Footer: User ──────────────────────────────────── */}
        <SidebarFooter>
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
          <div className="ml-auto">
            <FeedbackWidget />
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
