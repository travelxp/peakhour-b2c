"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/molecules/error-fallback";

export default function CmsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[cms/error]", error);
  }, [error]);

  return (
    <div className="p-4 md:p-6">
      <ErrorFallback error={error} reset={reset} />
    </div>
  );
}
