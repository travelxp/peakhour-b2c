"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { linkedInContentApi } from "@/lib/api/linkedin-content";

export function PostComposerSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-32 w-full" />
      <div className="flex justify-between">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  );
}

/**
 * Use the linkedin-me query as the data source for the composer's
 * picker. Lives beside the composer so the page can render the right shell
 * (composer, EmptyState, or Reconnect CTA) based on the same query.
 */
export function useLinkedInIdentity() {
  return useQuery({
    queryKey: ["linkedin-me"],
    queryFn: () => linkedInContentApi.me(),
    retry: (failureCount, err) => {
      if (err instanceof ApiError && (err.code === "NOT_CONNECTED" || err.status === 404)) {
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 60_000,
  });
}
