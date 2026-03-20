import { cn } from "@/lib/utils";

interface DividerWithLabelProps {
  label: string;
  className?: string;
}

function DividerWithLabel({ label, className }: DividerWithLabelProps) {
  return (
    <div className={cn("relative py-4", className)}>
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-border/20" />
      </div>
      <div className="relative flex justify-center">
        <span className="glass-panel rounded px-4 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground backdrop-blur-sm">
          {label}
        </span>
      </div>
    </div>
  );
}

export { DividerWithLabel };
export type { DividerWithLabelProps };
