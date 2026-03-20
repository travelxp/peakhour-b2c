import { cn } from "@/lib/utils";

interface MonoLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "xs" | "sm" | "md";
  color?: "primary" | "muted" | "faint" | "info";
  as?: "span" | "p" | "h4" | "div";
}

const sizeClasses = {
  xs: "text-[11px] tracking-widest",
  sm: "text-xs tracking-[0.2em]",
  md: "text-sm tracking-widest",
};

const colorClasses = {
  primary: "text-primary",
  muted: "text-muted-foreground",
  faint: "text-foreground/50",
  info: "text-[--ph-info]",
};

function MonoLabel({
  className,
  children,
  size = "xs",
  color = "muted",
  as: Tag = "span",
  ...props
}: MonoLabelProps) {
  return (
    <Tag
      className={cn(
        "font-mono font-medium uppercase",
        sizeClasses[size],
        colorClasses[color],
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

export { MonoLabel };
export type { MonoLabelProps };
