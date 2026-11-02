import type * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type Tone = "good" | "warn" | "bad" | "info" | "ai" | "neutral";

/** Tinted badge classes, the same token pairs `StatusBadge` uses. */
export const TONE_CLASS: Record<Tone, string> = {
  good: "bg-success/10 text-success-on-tint border-success/30",
  warn: "bg-warning/10 text-warning-on-tint border-warning/30",
  bad: "bg-destructive/10 text-destructive-on-tint border-destructive/30",
  info: "bg-state-info/10 text-state-info-on-tint border-state-info/30",
  ai: "bg-chart-2/10 text-chart-2 border-chart-2/30",
  neutral: "bg-muted text-muted-foreground border-border",
};

/** A badge in a tone. With `dot` it leads with a coloured dot, so state never rests on colour alone. */
export function ToneBadge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Badge variant="outline" className={cn(TONE_CLASS[tone], className)}>
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </Badge>
  );
}
