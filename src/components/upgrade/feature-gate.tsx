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

  // While loading, render the locked treatment — never expose
  // children fully interactive before entitlements resolve. A brief
  // "locked" flash beats briefly granting access. Keeps the JSDoc
  // promise above (locked-by-default semantics) honest.
  const showLocked = loading || !allowed;

  if (!showLocked) {
    return <>{children}</>;
  }

  // Locked.
  if (mode === "hide" || mode === "passthrough") {
    return fallback ?? null;
  }

  // Lock mode (default): muted children + upgrade affordance over them.
  // - `inert` disables pointer + keyboard interaction on the muted
  //   subtree (React 19+ supports inert natively). Without it, a
  //   focusable child (Switch, Input) stays tab-reachable and could
  //   be activated via keyboard despite the visual lock.
  // - The overlay container is `pointer-events-none` so empty space
  //   in the centered flex layout doesn't intercept attempts to click
  //   visible-but-muted children. Only the UpgradeButton itself
  //   captures pointer events.
  // - role="group" + aria-label give AT users a description of WHY
  //   the region is locked instead of just announcing "Unlock".
  const lockLabel = `Locked feature${featureName ? `: ${featureName}` : ""}. Upgrade required.`;
  return (
    <div
      className={cn("relative", className)}
      role="group"
      aria-label={lockLabel}
    >
      {/* @ts-expect-error -- React 19 supports the `inert` attribute, but TS DOM types haven't caught up everywhere. */}
      <div inert="" className="select-none opacity-50 filter-[saturate(0.8)]">
        {children}
      </div>
      <UpgradeBadge />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="pointer-events-auto">
          <UpgradeButton
            featureKey={feature}
            featureName={featureName}
            featureTagline={featureTagline}
          >
            Unlock
          </UpgradeButton>
        </span>
      </div>
    </div>
  );
}
