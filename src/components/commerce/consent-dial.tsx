"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { AutonomyLevel } from "@/hooks/use-commerce-autonomy";

/**
 * The consent dial — a 4-step control (L0 Observe → L3 Autonomous) for one
 * agent×channel. Built on the shadcn ToggleGroup (single-select); deselection
 * is ignored so the dial always holds a level.
 */
export const AUTONOMY_LEVEL_META: {
  value: AutonomyLevel;
  label: string;
  short: string;
  hint: string;
}[] = [
  { value: "observe", label: "Observe", short: "L0", hint: "Watches and surfaces insight only." },
  { value: "recommend", label: "Recommend", short: "L1", hint: "Proposes actions for your approval." },
  { value: "approve", label: "Approve", short: "L2", hint: "Stages actions; one tap to ship." },
  { value: "autonomous", label: "Autonomous", short: "L3", hint: "Acts within guardrails; reversible." },
];

export function ConsentDial({
  level,
  onChange,
  disabled,
}: {
  level: AutonomyLevel;
  onChange: (level: AutonomyLevel) => void;
  disabled?: boolean;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={level}
      disabled={disabled}
      onValueChange={(v) => {
        // ToggleGroup emits "" when the active item is re-clicked — ignore it
        // so the dial can't be emptied.
        if (v) onChange(v as AutonomyLevel);
      }}
      className="flex-wrap justify-start"
    >
      {AUTONOMY_LEVEL_META.map((m) => (
        <ToggleGroupItem
          key={m.value}
          value={m.value}
          aria-label={`${m.label} — ${m.hint}`}
          className="px-3"
        >
          {m.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
