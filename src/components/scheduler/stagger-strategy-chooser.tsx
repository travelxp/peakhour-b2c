"use client";

/**
 * <StaggerStrategyChooser /> — radio-card picker for synchronized /
 * rolling / smart with an inline explanation for each. Smart is the
 * locked default per content-pipeline-hardening.md decision #6.
 *
 * Implements the full ARIA radiogroup keyboard pattern: Left/Right/
 * Up/Down move selection and focus to the next option; Home/End
 * jump to first/last. Tab moves focus OUT of the group (not
 * between options) per the spec.
 */

import { useRef } from "react";
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
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (idx: number) => (e: React.KeyboardEvent) => {
    let nextIdx = -1;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIdx = (idx + 1) % OPTIONS.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIdx = (idx - 1 + OPTIONS.length) % OPTIONS.length;
        break;
      case "Home":
        nextIdx = 0;
        break;
      case "End":
        nextIdx = OPTIONS.length - 1;
        break;
    }
    if (nextIdx !== -1) {
      e.preventDefault();
      onChange(OPTIONS[nextIdx]!.value);
      refs.current[nextIdx]?.focus();
    }
  };

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
      {OPTIONS.map((opt, idx) => {
        const Icon = opt.icon;
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[idx] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            // Per ARIA radiogroup pattern: only the selected option
            // is in the tab order; arrows move within the group.
            tabIndex={selected ? 0 : -1}
            onKeyDown={onKeyDown(idx)}
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
