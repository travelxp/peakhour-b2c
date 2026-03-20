"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/ui/mono-label";
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
  Bell,
  UserCircle,
  Search,
  type LucideIcon,
} from "lucide-react";

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/content", label: "Content", icon: FileText },
  { href: "/dashboard/strategist", label: "Strategist", icon: Brain },
  { href: "/dashboard/calendar", label: "Calendar", icon: Calendar },
  { href: "/dashboard/ads", label: "Ads", icon: Megaphone },
  { href: "/dashboard/outcomes", label: "Outcomes", icon: TrendingUp },
  { href: "/dashboard/optimizer", label: "Optimizer", icon: Sparkles },
  { href: "/dashboard/integrations", label: "Integrations", icon: Plug },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
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
      <aside className="fixed left-0 top-0 z-60 flex h-screen w-64 flex-col gap-2 overflow-y-auto border-r border-foreground/15 bg-[#1b1c1e] py-6">
        {/* Logo */}
        <div className="px-6 mb-8">
          <h1 className="font-display text-xl font-extrabold tracking-tighter">
            Peakhour.ai
          </h1>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[--ph-surface-250]">
              <UserCircle className="h-5 w-5 text-foreground/60" />
            </div>
            <div>
              <MonoLabel size="xs" color="muted" className="text-[11px] tracking-widest text-foreground">
                Intelligence Hub
              </MonoLabel>
              <MonoLabel size="xs" color="primary" className="text-[9px]">
                Precision Mode
              </MonoLabel>
            </div>
          </div>
        </div>

        <OrgSwitcher />
        <BusinessSwitcher />

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-6 py-3 transition-colors duration-200 ease-out",
                  isActive
                    ? "border-l-2 border-primary bg-[#1f2022] text-primary"
                    : "text-foreground opacity-50 hover:bg-[#292a2c] hover:opacity-100"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <MonoLabel size="xs" className="text-[11px] tracking-widest text-current">
                  {item.label}
                </MonoLabel>
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-foreground/10 px-6 pt-4">
          <p className="mb-1 truncate text-xs font-medium">
            {user?.name || user?.email}
          </p>
          {org && (
            <p className="mb-2 truncate text-[11px] text-muted-foreground">
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
      <main className="ml-64 min-h-screen flex-1">
        {/* Top bar */}
        <header className="sticky top-0 z-50 flex items-center justify-between bg-background px-10 py-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 rounded-lg border border-border/15 bg-[--ph-bg-shell] px-4 py-2">
              <Search className="h-4 w-4 text-muted-foreground/50" />
              <input
                className="w-64 border-none bg-transparent text-sm outline-none placeholder:opacity-50 focus:ring-0"
                placeholder="Search insights..."
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="rounded-full p-2 text-foreground opacity-70 transition-all duration-200 hover:bg-[#1f2022] hover:opacity-100">
              <Bell className="h-5 w-5" />
            </button>
            <button className="rounded-full p-2 text-foreground opacity-70 transition-all duration-200 hover:bg-[#1f2022] hover:opacity-100">
              <UserCircle className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="mx-auto max-w-7xl space-y-12 px-10 py-10">
          {children}
        </div>

        {/* Background decoratives */}
        <div className="pointer-events-none fixed right-0 top-0 -z-10 h-125 w-125 rounded-full bg-primary/5 blur-[120px]" />
        <div className="pointer-events-none fixed bottom-0 left-64 -z-10 h-75 w-75 rounded-full bg-[--ph-info]/5 blur-[100px]" />
      </main>
    </div>
  );
}
