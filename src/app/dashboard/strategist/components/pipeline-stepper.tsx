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

export function PipelineStepper({ currentStatus }: { currentStatus: string }) {
  const currentIndex = PIPELINE_COLUMNS.findIndex(
    (col) => col.key === currentStatus
  );
  const resolvedIndex = currentIndex === -1 ? 0 : currentIndex;

  return (
    <div className="flex items-center w-full">
      {PIPELINE_COLUMNS.map((stage, i) => {
        const isCompleted = i < resolvedIndex;
        const isCurrent = i === resolvedIndex;
        const color = STAGE_COLORS[stage.key] || "rgb(115 115 115)";

        return (
          <div key={stage.key} className="flex items-center flex-1 last:flex-none">
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1.5">
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
                className={`text-[10px] leading-tight hidden sm:block ${
                  isCurrent
                    ? "font-semibold text-foreground"
                    : isCompleted
                      ? "text-muted-foreground"
                      : "text-muted-foreground/50"
                }`}
              >
                {stage.label}
              </span>
            </div>

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
