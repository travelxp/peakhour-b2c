"use client";

import { useFeature } from "@/hooks/use-feature";
import { cn } from "@/lib/utils";
import { UpgradeBadge } from "./upgrade-badge";
import { UpgradeButton } from "./upgrade-button";

/**
 * FeatureGate — wraps any UI subtree and gates it on a feature key
 * from the org's entitlements snapshot.
 *
 * Modes:
 *   "lock"  (default) — children render but are visually muted +
 *           pointer-events-none, with an UpgradeBadge in the corner.
 *           Clicking the wrapper opens the upgrade drawer. Best for
 *           feature toggles and individual rows the user shouldn't
 *           be allowed to interact with.
 *   "hide"  — children don't render at all when locked. Use for
 *           full-panel features where revealing-but-locking would be
 *           noisy. The fallback (typically a card with an explainer
 *           + UpgradeButton) renders in their place.
 *   "passthrough" — when allowed, returns children directly with no
 *           wrapper. When locked, renders fallback if provided, else
 *           null. Use when the parent controls the layout.
 *
 * While entitlements are loading, the component renders children
 * with reduced opacity (no flicker between "locked" and "allowed").
 */
export interface FeatureGateProps {
  feature: string;
  featureName?: string;
  featureTagline?: string;
  mode?: "lock" | "hide" | "passthrough";
  /** Rendered in place of children when mode != "lock" and the
   *  feature is locked. */
  fallback?: React.ReactNode;
  /** Wrapper className applied to the outer div in "lock" mode. */
  className?: string;
  children: React.ReactNode;
}

export function FeatureGate({
  feature,
  featureName,
  featureTagline,
  mode = "lock",
  fallback,
  className,
  children,
}: FeatureGateProps) {
  const { allowed, loading } = useFeature(feature);

  if (loading) {
    return <div className="opacity-70">{children}</div>;
  }

  if (allowed) {
    return mode === "passthrough" ? <>{children}</> : <>{children}</>;
  }

  // Locked.
  if (mode === "hide" || mode === "passthrough") {
    return fallback ?? null;
  }

  // Lock mode (default): show children muted + an upgrade affordance.
  return (
    <div className={cn("relative", className)}>
      <div className="pointer-events-none select-none opacity-50 [filter:saturate(0.8)]">
        {children}
      </div>
      <UpgradeBadge />
      <div className="absolute inset-0 flex items-center justify-center">
        <UpgradeButton
          featureKey={feature}
          featureName={featureName}
          featureTagline={featureTagline}
        >
          Unlock
        </UpgradeButton>
      </div>
    </div>
  );
}
