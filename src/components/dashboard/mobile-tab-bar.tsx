"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { FileText, LayoutDashboard, MessagesSquare, Menu, ShoppingBag, TrendingUp, type LucideIcon } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { HOME_ROUTE } from "@/lib/nav-home";
import { PILLAR_COPY } from "@/lib/nav-copy";
import { primaryTabs, isTabActive } from "@/lib/mobile-tabs";

const ICONS: Record<string, LucideIcon> = {
  home: LayoutDashboard,
  inbox: MessagesSquare,
  content: FileText,
  growth: TrendingUp,
  commerce: ShoppingBag,
};

function subscribeKeyboard(onChange: () => void) {
  const vv = window.visualViewport;
  vv?.addEventListener("resize", onChange);
  return () => vv?.removeEventListener("resize", onChange);
}

/** True while the soft keyboard covers the bottom of the screen. */
function keyboardSnapshot() {
  const vv = window.visualViewport;
  // A keyboard takes well over 150px; a retracting URL bar does not.
  return !!vv && window.innerHeight - vv.height > 150;
}

/**
 * Fixed bottom bar below the md breakpoint: four primary destinations and
 * More, which opens the full navigation sheet. It clears the iPhone home
 * indicator (safe-area inset) and steps aside while the keyboard is up. The
 * shell adds a matching spacer so no page content ends up behind it.
 */
export function MobileTabBar({
  hasCommerce,
  pathname,
  intentProps,
}: {
  hasCommerce: boolean;
  pathname: string;
  /** Hover/focus/touch handlers per href (hooks/use-nav-intent). The five tabs keep Next's viewport prefetch too. */
  intentProps?: (href: string) => React.HTMLAttributes<HTMLAnchorElement>;
}) {
  const { setOpenMobile } = useSidebar();
  const keyboardUp = useSyncExternalStore(subscribeKeyboard, keyboardSnapshot, () => false);
  const tabs = primaryTabs({ hasCommerce, homeHref: HOME_ROUTE });
  if (keyboardUp) return null;
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex h-14 items-stretch">
        {tabs.map((t) => {
          const Icon = ICONS[t.key];
          const copy = PILLAR_COPY[t.copyHref];
          const active = isTabActive(pathname, t);
          return (
            <li key={t.key} className="min-w-0 flex-1">
              <Link
                href={t.href}
                {...(intentProps ? intentProps(t.href) : {})}
                title={copy?.description}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-xs font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="max-w-full truncate px-1">{copy?.label ?? t.key}</span>
              </Link>
            </li>
          );
        })}
        <li className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setOpenMobile(true)}
            className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted-foreground"
          >
            <Menu className="size-5" aria-hidden />
            <span>More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
