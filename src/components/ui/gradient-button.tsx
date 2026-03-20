import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface GradientButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
  variant?: "gradient" | "outline";
}

const GradientButton = forwardRef<HTMLButtonElement, GradientButtonProps>(
  (
    {
      className,
      children,
      size = "md",
      loading = false,
      icon,
      variant = "gradient",
      disabled,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: "px-5 py-2.5 text-sm",
      md: "px-6 py-4 text-base",
      lg: "px-8 py-4 text-lg",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "group inline-flex items-center justify-center gap-2 rounded-md font-display font-bold transition-all duration-200 disabled:opacity-50",
          variant === "gradient"
            ? "bg-linear-to-br from-primary to-[--ph-amber-600] text-primary-foreground shadow-[0_8px_16px_rgba(245,158,11,0.2)] hover:brightness-110 hover:scale-[0.98] active:scale-[0.95]"
            : "border border-border text-foreground hover:bg-foreground hover:text-background",
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading ? "Loading..." : children}
        {icon && !loading && (
          <span className="transition-transform duration-200 group-hover:translate-x-0.5">
            {icon}
          </span>
        )}
      </button>
    );
  }
);
GradientButton.displayName = "GradientButton";

export { GradientButton };
export type { GradientButtonProps };
