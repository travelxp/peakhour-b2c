"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorFallbackProps {
  /** The error that was caught. `digest` is Next.js-only; absent for class-boundary catches. */
  error?: (Error & { digest?: string }) | null;
  /** Reset handler. For Next.js error.tsx pass the framework's `reset`; for class boundaries, pass your retry callback. */
  reset?: () => void;
  /** Override the default heading. */
  title?: string;
  /** Override the default body copy. */
  description?: string;
  /** Reset button label. Defaults to "Try again". */
  resetLabel?: string;
  /** Tailwind classes for the outer container. */
  className?: string;
}

export function ErrorFallback({
  error,
  reset,
  title = "Something went wrong",
  description = "We hit an unexpected error rendering this view. Try again, or reload the page.",
  resetLabel = "Try again",
  className,
}: ErrorFallbackProps) {
  const detail = error?.message?.trim();
  const digest = error?.digest;

  return (
    <div
      role="alert"
      className={cn(
        "flex min-h-100 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center",
        className,
      )}
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle aria-hidden="true" className="size-6 text-destructive" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>

      {detail && (
        <p className="mt-3 max-w-md font-mono text-xs text-muted-foreground/80 break-words">
          {detail}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {reset && (
          <Button onClick={reset}>
            <RotateCw className="mr-1.5 size-4" />
            {resetLabel}
          </Button>
        )}
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </div>

      {/* `digest` lets ops correlate this exact error with the server log entry.
          Hidden visually but selectable for support — kept small to avoid scaring users. */}
      {digest && (
        <p className="mt-4 text-[10px] text-muted-foreground/60 tabular-nums select-all">
          ref: {digest}
        </p>
      )}
    </div>
  );
}
