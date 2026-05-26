"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/molecules/error-fallback";

/**
 * Global error boundary — fires ONLY when the root `app/layout.tsx`
 * itself throws (i.e. before normal `error.tsx` boundaries can render).
 * Per Next.js, this component must provide its own <html>/<body> because
 * the root layout never mounted.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="container mx-auto p-6 md:p-10">
          <ErrorFallback
            error={error}
            reset={reset}
            title="The app failed to load"
            description="The root layout crashed before the page could render. This usually clears up with a reload."
          />
        </div>
      </body>
    </html>
  );
}
