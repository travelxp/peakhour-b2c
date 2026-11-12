"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Sparkles, type LucideIcon } from "lucide-react";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useEverOpened } from "@/hooks/use-ever-opened";

// Opens only on a click, so it is its own chunk; hovering or focusing the item requests it ahead of the click.
const loadUpgradeDrawer = () => import("@/components/upgrade/upgrade-drawer").then((m) => m.UpgradeDrawer);
const UpgradeDrawer = dynamic(loadUpgradeDrawer, { ssr: false });

/**
 * LockedNavItem — a top-level sidebar pillar the org is NOT entitled to,
 * rendered visible-but-locked instead of hidden. Reversing the earlier
 * "hide unentitled pillars" behaviour so gated pillars become an upsell
 * surface: owners discover Commerce/Presence/etc. and can self-serve the
 * upgrade rather than never learning the pillar exists.
 *
 * Unlike an entitled pillar it does NOT expand its sub-items or navigate.
 * Clicking opens the upgrade drawer scoped to the pillar's `.nav` feature
 * key (intent=plan_upgrade), so the waitlist/checkout copy and analytics
 * are tagged to what the user reached for. Mirrors the FeatureGate "lock"
 * affordance, applied at the nav level where FeatureGate isn't wired.
 */
export function LockedNavItem({
  icon: Icon,
  label,
  description,
  featureKey,
  tagline,
}: {
  icon: LucideIcon;
  label: string;
  /** One-line plain-language description, shown in the tooltip. */
  description?: string;
  /** cfg_features.key gating the pillar, e.g. "commerce.nav". */
  featureKey: string;
  tagline?: string;
}) {
  const [open, setOpen] = useState(false);
  const mounted = useEverOpened(open);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={description ? `${label}: ${description} Upgrade to unlock.` : `${label} — upgrade to unlock`}
        onClick={() => setOpen(true)}
        onPointerEnter={() => void loadUpgradeDrawer()}
        onFocus={() => void loadUpgradeDrawer()}
        className="text-sidebar-foreground/60"
      >
        <Icon />
        <span>{label}</span>
        <Sparkles className="ml-auto size-3.5 text-brand-label" />
      </SidebarMenuButton>
      {mounted && (
        <UpgradeDrawer
          open={open}
          onOpenChange={setOpen}
          featureKey={featureKey}
          featureName={label}
          featureTagline={tagline}
          intent="plan_upgrade"
        />
      )}
    </SidebarMenuItem>
  );
}
