"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/molecules/error-fallback";

/**
 * Dashboard-scoped error boundary. Sits below `app/error.tsx` and catches
 * render errors inside any `/dashboard/**` segment that doesn't have its
 * own `error.tsx`. Keeps the dashboard chrome (sidebar/topbar) intact so
 * the user can still navigate away from a broken page.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard/error]", error);
  }, [error]);

  // Dashboard layout already wraps {children} in a `p-6` container, so we
  // render the fallback directly — adding our own padding would double up
  // and push the card off-grid.
  return <ErrorFallback error={error} reset={reset} />;
}
