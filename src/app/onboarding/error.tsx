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

  return (
    <div className="container mx-auto p-6 md:p-10">
      <ErrorFallback error={error} reset={reset} />
    </div>
  );
}
