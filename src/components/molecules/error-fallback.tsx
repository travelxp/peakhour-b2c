"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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

/**
 * Error variant of the shadcn `Empty` primitive — same visual chrome as
 * EmptyState so error/empty/no-results screens read from one vocabulary.
 * Used by every `error.tsx` boundary and the class `ErrorBoundary`.
 */
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
    <Empty
      role="alert"
      className={cn("border border-destructive/30 bg-destructive/5", className)}
    >
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="bg-destructive/10 text-destructive [&_svg:not([class*='size-'])]:size-6"
        >
          <AlertTriangle />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        {detail && (
          <p className="font-mono text-xs text-muted-foreground/80 wrap-break-word">
            {detail}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
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

        {/* `digest` lets ops correlate this exact error with the server log
            entry. Hidden visually but selectable for support. */}
        {digest && (
          <p className="text-[10px] text-muted-foreground/60 tabular-nums select-all">
            ref: {digest}
          </p>
        )}
      </EmptyContent>
    </Empty>
  );
}
