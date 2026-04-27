"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/providers/auth-provider";
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
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { OrgSwitcher } from "@/components/dashboard/org-switcher";
import { BusinessSwitcher } from "@/components/dashboard/business-switcher";
import {
  LayoutDashboard,
  TicketCheck,
  Users,
  Brain,
  LogOut,
  ChevronsUpDown,
  ArrowLeftRight,
  Zap,
  Activity,
  ScrollText,
  Cpu,
  SlidersHorizontal,
  Wand2,
  Network,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const CMS_NAV_GROUPS: NavGroup[] = [
  {
    label: "",
    items: [
      { href: "/cms/overview", label: "Overview", icon: LayoutDashboard },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/cms/feedback", label: "Feedback Tickets", icon: TicketCheck },
      { href: "/cms/skills", label: "Skills", icon: Zap },
      { href: "/cms/team", label: "CMS Team", icon: Users },
    ],
  },
  {
    label: "AI Operations",
    items: [
      { href: "/cms/ai-health", label: "Health", icon: Activity },
      { href: "/cms/ai-usage", label: "Usage", icon: Brain },
      { href: "/cms/ai-logs", label: "Logs", icon: ScrollText },
      { href: "/cms/ai-models", label: "Model Registry", icon: Cpu },
      { href: "/cms/ai-config", label: "Configuration", icon: SlidersHorizontal },
      { href: "/cms/ai-evaluator", label: "Evaluator", icon: Wand2 },
    ],
  },
  {
    label: "Observability",
    items: [
      { href: "/cms/logs", label: "Application Logs", icon: ScrollText },
      { href: "/cms/api-logs", label: "API Logs", icon: Network },
      { href: "/cms/auth-logs", label: "Auth Logs", icon: ShieldCheck },
    ],
  },
];

export default function CmsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CmsShell>{children}</CmsShell>;
}

function CmsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, org, logout, isLoading, isAuthenticated } = useAuth();

  // Guard: redirect non-CMS users
  useEffect(() => {
    if (!isLoading && isAuthenticated && !user?.cmsUser) {
      router.replace("/dashboard/overview");
    }
    if (!isLoading && !isAuthenticated) {
      router.replace("/auth");
    }
  }, [isLoading, isAuthenticated, user?.cmsUser, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user?.cmsUser) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Access denied. CMS access required.
        </p>
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
        {/* ── Header: CMS branding + Switchers ──────────── */}
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/cms/overview">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-orange-600 text-white">
                    <span className="text-sm font-bold">C</span>
                  </div>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-semibold">
                      PeakHour CMS
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      Internal Admin
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

        {/* ── Navigation ────────────────────────────────── */}
        <SidebarContent>
          {CMS_NAV_GROUPS.map((group, idx) => (
            <SidebarGroup key={group.label || `group-${idx}`}>
              {group.label && (
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      pathname === item.href ||
                      pathname?.startsWith(item.href + "/");
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

          {/* Switch to Dashboard link */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Switch to Dashboard">
                    <Link href="/dashboard/overview">
                      <ArrowLeftRight />
                      <span>Switch to Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* ── Footer: User ──────────────────────────────── */}
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
                    <Link href="/dashboard/overview">
                      <ArrowLeftRight className="mr-2 size-4" />
                      Switch to Dashboard
                    </Link>
                  </DropdownMenuItem>
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

      {/* ── Main Content ──────────────────────────────── */}
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="ml-auto flex items-center gap-2">
            <span className="rounded-md bg-orange-600/10 px-2 py-0.5 text-xs font-medium text-orange-600">
              CMS
            </span>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
