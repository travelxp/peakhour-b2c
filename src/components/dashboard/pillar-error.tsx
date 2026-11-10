"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorFallback } from "@/components/molecules/error-fallback";
import { openFeedback } from "@/lib/dashboard-events";
import { navLabel } from "@/lib/nav-copy";

interface PillarErrorProps {
  /** The section's route. Its merchant-facing name comes from nav-copy, so the
   *  error page calls the section what the sidebar calls it. */
  href: string;
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Body of every dashboard pillar's `error.tsx`. Retry calls the framework's
 * `reset`, "Back to Home" always works, and "Report this" opens the
 * feedback sheet that lives in the dashboard top bar.
 */
export function PillarError({ href, error, reset }: PillarErrorProps) {
  const area = navLabel(href);
  useEffect(() => {
    console.error(`[${href}/error]`, error);
  }, [href, error]);

  return (
    <div className="flex flex-col items-center gap-3">
      <ErrorFallback
        error={error}
        reset={reset}
        title={`${area} hit a problem`}
        description={`Something went wrong while showing ${area}. Your work is safe. Try again, or head back to Home and come back in a moment.`}
        className="w-full"
      />
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/overview">
            <Home className="mr-1.5 size-4" />
            Back to Home
          </Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={openFeedback}>
          <MessageSquareWarning className="mr-1.5 size-4" />
          Report this
        </Button>
      </div>
    </div>
  );
}
