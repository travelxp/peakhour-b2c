"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/molecules/error-fallback";

export default function OnboardingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[onboarding/error]", error);
  }, [error]);

  // Onboarding layout already wraps in a max-w-2xl padded container —
  // render directly to avoid double-wrap + container/max-width fight.
  return <ErrorFallback error={error} reset={reset} />;
}
