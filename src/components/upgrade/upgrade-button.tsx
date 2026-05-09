"use client";

import { useState } from "react";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type ButtonSize = "default" | "sm" | "lg" | "icon" | null | undefined;
import { cn } from "@/lib/utils";
import { GradientRing } from "./gradient-ring";
import { UpgradeDrawer } from "./upgrade-drawer";

/**
 * UpgradeButton — single CTA the rest of the app uses to open the
 * upgrade drawer. Renders a gradient-ringed Pro chip by default; pass
 * `variant="inline-link"` for a low-emphasis text link, or
 * `variant="ghost"` for a flat button.
 *
 * Owns its own drawer instance — clicking opens, closing resets form.
 * No global mounting required for v1.
 */
export interface UpgradeButtonProps {
  /** cfg_features.key — what the user clicked into. Surfaced in
   *  drawer copy and tagged on every waitlist signup for analytics. */
  featureKey?: string;
  featureName?: string;
  featureTagline?: string;
  /** Default "pill" — the brand pill with rotating gradient ring.
   *  "ghost" — flat secondary; "inline-link" — text link. */
  variant?: "pill" | "ghost" | "inline-link";
  size?: ButtonSize;
  className?: string;
  children?: React.ReactNode;
  /** Override drawer mode. Defaults to "waitlist". */
  mode?: "waitlist" | "checkout";
  intent?: "plan_upgrade" | "addon" | "integration" | "general";
  addonKey?: string;
  integrationKey?: string;
}

export function UpgradeButton(props: UpgradeButtonProps) {
  const [open, setOpen] = useState(false);
  const {
    featureKey,
    featureName,
    featureTagline,
    variant = "pill",
    size,
    className,
    children,
    mode,
    intent,
    addonKey,
    integrationKey,
  } = props;

  const label = children ?? "Upgrade";

  return (
    <>
      {variant === "pill" ? (
        <span className={cn("group/gradient-ring relative inline-block rounded-full", className)}>
          <GradientRing />
          <Button
            type="button"
            size={size ?? "sm"}
            onClick={() => setOpen(true)}
            className={cn(
              "relative rounded-full gap-1.5",
              "bg-gradient-to-r from-amber-50 to-amber-100 text-amber-900 hover:from-amber-100 hover:to-amber-200",
              "dark:from-amber-950 dark:to-amber-900 dark:text-amber-200 dark:hover:from-amber-900 dark:hover:to-amber-800",
              "border-0 shadow-sm",
            )}
          >
            <Sparkles className="size-3.5" />
            {label}
          </Button>
        </span>
      ) : variant === "inline-link" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex items-center gap-1 text-sm font-medium",
            "text-primary underline-offset-2 hover:underline",
            className,
          )}
        >
          <Lock className="size-3.5" />
          {label}
        </button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size={size}
          onClick={() => setOpen(true)}
          className={className}
        >
          <Lock className="size-3.5 mr-1.5" />
          {label}
        </Button>
      )}

      <UpgradeDrawer
        open={open}
        onOpenChange={setOpen}
        featureKey={featureKey}
        featureName={featureName}
        featureTagline={featureTagline}
        mode={mode}
        intent={intent}
        addonKey={addonKey}
        integrationKey={integrationKey}
      />
    </>
  );
}
