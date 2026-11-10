"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorFallback } from "@/components/molecules/error-fallback";
import { openFeedback } from "@/lib/dashboard-events";

interface PillarErrorProps {
  /** Plain-language name of the section, e.g. "Growth". Used in the copy and the log tag. */
  area: string;
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Body of every dashboard pillar's `error.tsx`. Retry calls the framework's
 * `reset`, "Back to overview" always works, and "Report this" opens the
 * feedback sheet that lives in the dashboard top bar.
 */
export function PillarError({ area, error, reset }: PillarErrorProps) {
  useEffect(() => {
    console.error(`[dashboard/${area}/error]`, error);
  }, [area, error]);

  return (
    <div className="flex flex-col items-center gap-3">
      <ErrorFallback
        error={error}
        reset={reset}
        title={`${area} hit a problem`}
        description={`Something went wrong while showing ${area}. Your work is safe. Try again, or head back to your overview and come back in a moment.`}
        className="w-full"
      />
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/overview">
            <Home className="mr-1.5 size-4" />
            Back to overview
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
