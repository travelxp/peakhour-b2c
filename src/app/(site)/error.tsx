"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/molecules/error-fallback";

/**
 * Root error boundary. Catches render errors anywhere below the root
 * layout — including dashboard, CMS, onboarding etc. — that aren't caught
 * by a closer per-segment `error.tsx`. Sibling to `global-error.tsx`,
 * which only fires if the root layout itself crashes.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Visible in the browser console + Vercel runtime logs. Sentry/etc.
    // can hook in here later by reading `error.digest` for correlation.
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="container mx-auto p-6 md:p-10">
      <ErrorFallback error={error} reset={reset} />
    </div>
  );
}
