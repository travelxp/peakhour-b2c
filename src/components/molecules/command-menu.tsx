"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  FileText,
  Brain,
  Calendar,
  Megaphone,
  TrendingUp,
  Sparkles,
  Plug,
  Settings,
  LineChart,
  Search,
  Building2,
  Users,
} from "lucide-react";

const PAGES = [
  { label: "Overview", href: "/dashboard/overview", icon: LayoutDashboard, group: "Navigation" },
  { label: "Content Library", href: "/dashboard/content", icon: FileText, group: "Navigation" },
  { label: "Strategist", href: "/dashboard/strategist", icon: Brain, group: "Navigation" },
  { label: "Calendar", href: "/dashboard/calendar", icon: Calendar, group: "Navigation" },
  // ★THE SECOND NAVIGATION SURFACE, AND IT WAS MISSED BY BOTH G1 AND G2 — on a
  // pair of pages whose entire thesis is that nobody could find them.
  { label: "Your Business", href: "/dashboard/growth/business", icon: Building2, group: "Navigation" },
  { label: "Audiences", href: "/dashboard/growth/audiences", icon: Users, group: "Navigation" },
  { label: "Ads", href: "/dashboard/ads", icon: Megaphone, group: "Navigation" },
  { label: "Outcomes", href: "/dashboard/outcomes", icon: TrendingUp, group: "Navigation" },
  { label: "Optimizer", href: "/dashboard/optimizer", icon: Sparkles, group: "Navigation" },
  { label: "Web Analytics", href: "/dashboard/insights/analytics", icon: LineChart, group: "Navigation" },
  { label: "Search Console", href: "/dashboard/insights/search-console", icon: Search, group: "Navigation" },
  { label: "Integrations", href: "/dashboard/integrations", icon: Plug, group: "Settings" },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, group: "Settings" },
] as const;

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const groups = [...new Set(PAGES.map((p) => p.group))];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {groups.map((group, idx) => (
          <div key={group}>
            {idx > 0 && <CommandSeparator />}
            <CommandGroup heading={group}>
              {PAGES.filter((p) => p.group === group).map((page) => {
                const Icon = page.icon;
                return (
                  <CommandItem
                    key={page.href}
                    value={page.label}
                    onSelect={() => runCommand(page.href)}
                  >
                    <Icon className="mr-2 size-4" />
                    <span>{page.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
