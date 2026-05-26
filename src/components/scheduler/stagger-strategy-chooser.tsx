"use client";

/**
 * <StaggerStrategyChooser /> — radio-card picker for synchronized /
 * rolling / smart with an inline explanation for each. Smart is the
 * locked default per content-pipeline-hardening.md decision #6.
 */

import { Sparkles, Layers, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { staggerDescription } from "@/lib/scheduler/format";
import type { StaggerStrategy } from "@/lib/scheduler/types";

const OPTIONS: {
  value: StaggerStrategy;
  label: string;
  icon: typeof Sparkles;
}[] = [
  { value: "smart", label: "Smart time", icon: Sparkles },
  { value: "rolling", label: "Rolling stagger", icon: Layers },
  { value: "synchronized", label: "Synchronized", icon: Zap },
];

export interface StaggerStrategyChooserProps {
  value: StaggerStrategy;
  onChange: (next: StaggerStrategy) => void;
  className?: string;
  /** When true, render only the chip strip without the per-card
   *  description text — useful for tight composer layouts. */
  compact?: boolean;
}

export function StaggerStrategyChooser({
  value,
  onChange,
  className,
  compact,
}: StaggerStrategyChooserProps) {
  return (
    <div
      className={cn(
        "grid gap-2",
        compact
          ? "grid-cols-3"
          : "grid-cols-1 sm:grid-cols-3",
        className,
      )}
      role="radiogroup"
      aria-label="Stagger strategy"
    >
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "group flex flex-col rounded-lg border p-3 text-left transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-input hover:border-primary/50 hover:bg-accent/50",
            )}
          >
            <div className="flex items-center gap-2">
              <Icon
                className={cn(
                  "h-4 w-4",
                  selected ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span
                className={cn(
                  "text-sm font-medium",
                  selected ? "text-foreground" : "text-foreground/90",
                )}
              >
                {opt.label}
              </span>
              {opt.value === "smart" && (
                <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                  Default
                </span>
              )}
            </div>
            {!compact && (
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                {staggerDescription(opt.value)}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
