"use client";

import type * as React from "react";
import { ErrorFallback } from "@/components/molecules/error-fallback";
import { Skeleton } from "@/components/ui/skeleton";
import { PreviewBanner } from "./preview-banner";

/** What the boundary reads of a query: a plain query, or an infinite one with a `select` (the Decisions screen). */
export interface BoundaryQuery<T> {
  isError: boolean;
  error: Error | null;
  data: T | undefined;
  refetch: () => unknown;
}

/**
 * Loading, error and preview handling shared by the five Growth v2 screens.
 *
 * - A real failure (anything but 501 NOT_BUILT) shows the error with a retry. The
 *   hooks never turn one into sample data.
 * - A preview result wears the "Preview data" banner above the screen.
 */
export function QueryBoundary<T extends { preview: boolean; row?: string }>({
  query,
  children,
}: {
  query: BoundaryQuery<T>;
  children: (result: T) => React.ReactNode;
}) {
  if (query.isError) {
    return (
      <ErrorFallback
        error={query.error}
        reset={() => void query.refetch()}
        title="Couldn't load this screen"
        description="Your numbers are fine. We just couldn't fetch them. Try again in a moment."
      />
    );
  }
  if (!query.data) {
    return (
      <div className="grid gap-4" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      {query.data.preview ? <PreviewBanner row={query.data.row} /> : null}
      {children(query.data)}
    </div>
  );
}
