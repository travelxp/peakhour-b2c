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

  return (
    <div className="p-4 md:p-6">
      <ErrorFallback error={error} reset={reset} />
    </div>
  );
}
