"use client";

import { Check } from "lucide-react";

/** 5 visual steps — each maps to a content panel */
const STEPS = [
  { key: "overview", label: "Ideate", color: "rgb(59 130 246)" },     // blue
  { key: "brief", label: "Brief", color: "rgb(99 102 241)" },         // indigo
  { key: "write", label: "Write", color: "rgb(245 158 11)" },         // amber
  { key: "review", label: "Review", color: "rgb(168 85 247)" },       // purple
  { key: "publish", label: "Publish", color: "rgb(34 197 94)" },      // green
] as const;

/** Maps each DB status → step panel key */
export const STAGE_PANEL_MAP: Record<string, string> = {
  brainstorm: "overview",
  planned: "overview",
  brief_ready: "brief",
  writing: "write",
  in_progress: "write",
  review: "review",
  approved: "review",
  scheduled: "publish",
  published: "publish",
};

/** Maps DB status → step index (0-4) for progress tracking */
const STATUS_STEP_INDEX: Record<string, number> = {
  brainstorm: 0,
  planned: 0,
  brief_ready: 1,
  writing: 2,
  in_progress: 2,
  review: 3,
  approved: 3,
  scheduled: 4,
  published: 4,
};

export function PipelineStepper({
  currentStatus,
  activePanel,
  onStepClick,
}: {
  currentStatus: string;
  activePanel?: string;
  onStepClick?: (panel: string) => void;
}) {
  const currentStepIndex = STATUS_STEP_INDEX[currentStatus] ?? 0;

  return (
    <div className="flex items-center w-full">
      {STEPS.map((step, i) => {
        const isCompleted = i < currentStepIndex;
        const isCurrent = i === currentStepIndex;
        const isNext = i === currentStepIndex + 1;
        const isClickable = (i <= currentStepIndex + 1) && !!onStepClick;
        const isActivePanel = activePanel === step.key;

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStepClick!(step.key)}
              className={`flex flex-col items-center gap-1.5 ${isClickable ? "cursor-pointer" : "cursor-default"}`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-all ${
                  isCompleted
                    ? "text-white"
                    : isCurrent
                      ? ""
                      : isNext
                        ? "border-2 border-dashed border-muted-foreground/30 text-muted-foreground/50"
                        : "border-2 border-muted-foreground/20 text-muted-foreground/30"
                }`}
                style={
                  isCompleted
                    ? { backgroundColor: step.color }
                    : isCurrent
                      ? { border: `2px solid ${step.color}`, color: step.color, boxShadow: `0 0 0 3px color-mix(in srgb, ${step.color} 20%, transparent)` }
                      : undefined
                }
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : isCurrent ? (
                  <div
                    className="h-2.5 w-2.5 rounded-full animate-pulse"
                    style={{ backgroundColor: step.color }}
                  />
                ) : (
                  <span className="text-[11px]">{i + 1}</span>
                )}
              </div>
              <span
                className={`text-xs leading-tight transition-colors ${
                  isActivePanel
                    ? "font-bold"
                    : isCurrent
                      ? "font-semibold text-foreground"
                      : isCompleted
                        ? "font-medium text-muted-foreground"
                        : "text-muted-foreground/40"
                }`}
                style={isActivePanel ? { color: step.color } : undefined}
              >
                {step.label}
              </span>
            </button>

            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-2 rounded-full transition-colors ${
                  i < currentStepIndex
                    ? ""
                    : "bg-muted-foreground/10"
                }`}
                style={
                  i < currentStepIndex
                    ? { backgroundColor: `color-mix(in srgb, ${step.color} 40%, transparent)` }
                    : undefined
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
