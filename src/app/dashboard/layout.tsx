"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { OrgSwitcher } from "@/components/dashboard/org-switcher";
import { BusinessSwitcher } from "@/components/dashboard/business-switcher";
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
  type LucideIcon,
} from "lucide-react";

interface NavItem { href: string; label: string; icon: LucideIcon }
interface NavGroup { label: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    label: "",
    items: [
      { href: "/dashboard/overview", label: "Overview", icon: LayoutDashboard },
    ],
  },
  {
    label: "Content Cockpit",
    items: [
      { href: "/dashboard/content", label: "Library", icon: FileText },
      { href: "/dashboard/strategist", label: "Strategist", icon: Brain },
      { href: "/dashboard/calendar", label: "Calendar", icon: Calendar },
    ],
  },
  {
    label: "Growth",
    items: [
      { href: "/dashboard/ads", label: "Ads", icon: Megaphone },
      { href: "/dashboard/outcomes", label: "Outcomes", icon: TrendingUp },
      { href: "/dashboard/optimizer", label: "Optimizer", icon: Sparkles },
    ],
  },
  {
    label: "",
    items: [
      { href: "/dashboard/integrations", label: "Integrations", icon: Plug },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
];

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
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <p className="text-muted-foreground">Please sign in to continue.</p>
          <Button asChild>
            <Link href="/auth">Sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 border-r bg-card flex flex-col">
        <div className="px-5 py-5">
          <h1 className="text-lg font-bold tracking-tight">PeakHour</h1>
        </div>
        <OrgSwitcher />
        <BusinessSwitcher />
        <Separator />
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label || "ungrouped-" + group.items[0]?.href}>
              {group.label && (
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <Separator />
        <div className="px-4 py-3">
          <p className="text-xs font-medium truncate mb-1">
            {user?.name || user?.email}
          </p>
          {org && (
            <p className="text-[11px] text-muted-foreground truncate mb-2">
              {org.name}
            </p>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => logout()}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
