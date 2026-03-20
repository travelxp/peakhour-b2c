import { cn } from "@/lib/utils";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  shadow?: "sm" | "md" | "lg";
  padding?: "sm" | "md" | "lg";
}

const shadowClasses = {
  sm: "shadow-lg",
  md: "shadow-[0_24px_48px_rgba(0,0,0,0.15)]",
  lg: "shadow-2xl",
};

const paddingClasses = {
  sm: "p-6",
  md: "p-8 sm:p-10",
  lg: "p-10 md:p-12",
};

function GlassPanel({
  className,
  children,
  shadow = "md",
  padding = "md",
  ...props
}: GlassPanelProps) {
  return (
    <div
      className={cn(
        "glass-panel rounded-xl border border-foreground/10",
        shadowClasses[shadow],
        paddingClasses[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { GlassPanel };
export type { GlassPanelProps };
