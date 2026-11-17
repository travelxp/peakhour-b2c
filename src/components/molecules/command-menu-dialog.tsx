"use client";

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
  Coins,
  Lightbulb,
  ShieldCheck,
  Target,
  HardDrive,
  ChevronRight,
} from "lucide-react";
import { PILLAR_COPY, SUB_COPY, type NavCopy } from "@/lib/nav-copy";

const PAGES = [
  { label: "Overview", href: "/dashboard/overview", icon: LayoutDashboard, group: "Navigation" },
  { label: "Content Library", href: "/dashboard/content", icon: FileText, group: "Navigation" },
  { label: "Drive", href: "/dashboard/drive", icon: HardDrive, group: "Navigation" },
  { label: "Strategist", href: "/dashboard/strategist", icon: Brain, group: "Navigation" },
  { label: "Calendar", href: "/dashboard/calendar", icon: Calendar, group: "Navigation" },
  // ★THE SECOND NAVIGATION SURFACE, AND IT WAS MISSED BY BOTH G1 AND G2 — on a
  // pair of pages whose entire thesis is that nobody could find them.
  { label: "Your Business", href: "/dashboard/growth/rules/business", icon: Building2, group: "Navigation" },
  { label: "Audiences", href: "/dashboard/growth/rules/audiences", icon: Users, group: "Navigation" },
  { label: "Ads", href: "/dashboard/ads", icon: Megaphone, group: "Navigation" },
  { label: "Growth home", href: "/dashboard/growth", icon: TrendingUp, group: "Navigation" },
  { label: "Suggested actions", href: "/dashboard/growth/decisions", icon: Sparkles, group: "Navigation" },
  { label: "Ad channels & budget", href: "/dashboard/growth/channels", icon: Coins, group: "Navigation" },
  { label: "What's working", href: "/dashboard/growth/learning", icon: Lightbulb, group: "Navigation" },
  { label: "Goals", href: "/dashboard/growth/goals", icon: Target, group: "Navigation" },
  { label: "Guardrails", href: "/dashboard/growth/rules", icon: ShieldCheck, group: "Navigation" },
  { label: "Web Analytics", href: "/dashboard/insights/analytics", icon: LineChart, group: "Navigation" },
  { label: "Search Console", href: "/dashboard/insights/search-console", icon: Search, group: "Navigation" },
  { label: "Integrations", href: "/dashboard/integrations", icon: Plug, group: "Settings" },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, group: "Settings" },
] as const;

interface PageEntry {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  group: string;
  description?: string;
  keywords: string[];
}

const copyFor = (href: string): NavCopy | undefined => SUB_COPY[href] ?? PILLAR_COPY[href];

/**
 * The hand-written PAGES above keep their icons and order, but show the
 * plain-language label from nav-copy and keep the old name searchable. Every
 * other sub-page in nav-copy that PAGES does not list (Ledger, News Desk, Win
 * back carts ...) is appended, so searching a name the screen used to carry
 * still finds it.
 */
export const ENTRIES: PageEntry[] = (() => {
  const seen = new Set<string>();
  const listed: PageEntry[] = PAGES.map((p) => {
    seen.add(p.href);
    const c = copyFor(p.href);
    return {
      label: c?.label ?? p.label,
      href: p.href,
      icon: p.icon,
      group: p.group,
      description: c?.description,
      keywords: [p.label, ...(c?.aliases ?? [])],
    };
  });
  const extra: PageEntry[] = Object.entries({ ...PILLAR_COPY, ...SUB_COPY })
    .filter(([href]) => !seen.has(href))
    .map(([href, c]) => ({
      label: c.label,
      href,
      icon: ChevronRight,
      group: "Navigation",
      description: c.description,
      keywords: c.aliases ?? [],
    }));
  return [...listed, ...extra];
})();

export function CommandMenuDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  const runCommand = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const groups = [...new Set(ENTRIES.map((p) => p.group))];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {groups.map((group, idx) => (
          <div key={group}>
            {idx > 0 && <CommandSeparator />}
            <CommandGroup heading={group}>
              {ENTRIES.filter((p) => p.group === group).map((page) => {
                const Icon = page.icon;
                return (
                  <CommandItem
                    key={page.href}
                    value={page.href}
                    keywords={[page.label, ...page.keywords, ...(page.description ? [page.description] : [])]}
                    onSelect={() => runCommand(page.href)}
                  >
                    <Icon className="mr-2 size-4" />
                    <span>{page.label}</span>
                    {page.description && (
                      <span className="ml-2 hidden truncate text-xs text-muted-foreground sm:inline">
                        {page.description}
                      </span>
                    )}
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
