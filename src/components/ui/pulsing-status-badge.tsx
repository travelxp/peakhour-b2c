import { cn } from "@/lib/utils";
import { MonoLabel } from "./mono-label";

interface PulsingStatusBadgeProps {
  label: string;
  variant?: "ping" | "glow";
  color?: "primary" | "success";
  className?: string;
}

function PulsingStatusBadge({
  label,
  variant = "ping",
  color = "primary",
  className,
}: PulsingStatusBadgeProps) {
  const dotColor = color === "primary" ? "bg-primary" : "bg-[--ph-success]";
  const glowColor =
    color === "primary"
      ? "shadow-[0_0_8px_var(--ph-amber-500)]"
      : "shadow-[0_0_8px_var(--ph-success)]";

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {variant === "ping" ? (
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              dotColor
            )}
          />
          <span
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              dotColor
            )}
          />
        </span>
      ) : (
        <div className={cn("h-2 w-2 rounded-full", dotColor, glowColor)} />
      )}
      <MonoLabel size="sm" color="muted" className="font-semibold">
        {label}
      </MonoLabel>
    </div>
  );
}

export { PulsingStatusBadge };
export type { PulsingStatusBadgeProps };
