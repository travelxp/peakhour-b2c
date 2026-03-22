"use client";

import { Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PIPELINE_COLUMNS } from "./status-badge";

const STAGE_COLORS: Record<string, string> = {
  brainstorm: "rgb(115 115 115)",       // secondary/neutral
  planned: "rgb(59 130 246)",           // blue-500
  brief_ready: "rgb(99 102 241)",       // indigo-500
  writing: "rgb(245 158 11)",           // amber-500
  review: "rgb(168 85 247)",            // purple-500
  approved: "rgb(16 185 129)",          // emerald-500
  scheduled: "rgb(6 182 212)",          // cyan-500
  published: "rgb(34 197 94)",          // green-500
};

/** Maps each pipeline stage to its content panel */
export const STAGE_PANEL_MAP: Record<string, string> = {
  brainstorm: "overview",
  planned: "overview",
  brief_ready: "brief",
  writing: "write",
  review: "review",
  approved: "publish",
  scheduled: "publish",
  published: "publish",
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
  const currentIndex = PIPELINE_COLUMNS.findIndex(
    (col) => col.key === currentStatus
  );
  const resolvedIndex = currentIndex === -1 ? 0 : currentIndex;

  return (
    <div className="flex items-center w-full">
      {PIPELINE_COLUMNS.map((stage, i) => {
        const isCompleted = i < resolvedIndex;
        const isCurrent = i === resolvedIndex;
        const isClickable = i <= resolvedIndex && onStepClick;
        const panel = STAGE_PANEL_MAP[stage.key] || "overview";
        const isActivePanel = activePanel === panel;
        const color = STAGE_COLORS[stage.key] || "rgb(115 115 115)";

        return (
          <div key={stage.key} className="flex items-center flex-1 last:flex-none">
            {/* Step circle + label */}
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStepClick(panel)}
              className={`flex flex-col items-center gap-1.5 ${isClickable ? "cursor-pointer" : "cursor-default"}`}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-all ${
                      isCompleted
                        ? "text-white"
                        : isCurrent
                          ? ""
                          : "border-2 border-muted-foreground/25 text-muted-foreground/40"
                    }`}
                    style={
                      isCompleted
                        ? { backgroundColor: color }
                        : isCurrent
                          ? { border: `2px solid ${color}`, color, boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 20%, transparent)` }
                          : undefined
                    }
                  >
                    {isCompleted ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : isCurrent ? (
                      <div
                        className="h-2 w-2 rounded-full animate-pulse"
                        style={{ backgroundColor: color }}
                      />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/25" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {stage.label}
                </TooltipContent>
              </Tooltip>
              <span
                className={`text-[10px] leading-tight hidden sm:block transition-colors ${
                  isActivePanel && (isCompleted || isCurrent)
                    ? "font-bold"
                    : isCurrent
                      ? "font-semibold text-foreground"
                      : isCompleted
                        ? "text-muted-foreground"
                        : "text-muted-foreground/50"
                }`}
                style={isActivePanel && (isCompleted || isCurrent) ? { color } : undefined}
              >
                {stage.label}
              </span>
            </button>

            {/* Connector line */}
            {i < PIPELINE_COLUMNS.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-1 rounded-full ${
                  i < resolvedIndex
                    ? "bg-muted-foreground/30"
                    : "bg-muted-foreground/10"
                }`}
                style={
                  i < resolvedIndex
                    ? { backgroundColor: `color-mix(in srgb, ${color} 40%, transparent)` }
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
