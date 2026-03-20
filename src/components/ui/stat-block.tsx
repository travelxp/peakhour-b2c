import { cn } from "@/lib/utils";
import { MonoLabel } from "./mono-label";

interface StatBlockProps {
  label: string;
  value: string;
  description?: string;
  valueSize?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const valueSizeClasses = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-3xl",
  xl: "text-4xl",
};

function StatBlock({
  label,
  value,
  description,
  valueSize = "md",
  className,
}: StatBlockProps) {
  return (
    <div className={cn(className)}>
      <MonoLabel size="xs" color="faint">
        {label}
      </MonoLabel>
      <div
        className={cn(
          "mt-1 font-display font-bold",
          valueSizeClasses[valueSize]
        )}
      >
        {value}
      </div>
      {description && (
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

export { StatBlock };
export type { StatBlockProps };
