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

  // CMS layout already pads `{children}` with p-6 — render directly.
  return <ErrorFallback error={error} reset={reset} />;
}
