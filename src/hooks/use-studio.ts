"use client";

import { useQuery } from "@tanstack/react-query";
import { creativeApi, UNAVAILABLE, type PostIdeasResponse, type StudioAvailability } from "@/lib/api/creative";
import { useAuth } from "@/providers/auth-provider";

/** Query keys in one place so a mutation can name the one it changes. */
export const STUDIO_KEYS = {
  ideas: "studio-post-ideas",
  availability: "studio-availability",
} as const;

/**
 * Post ideas for you: free, rule-based, no AI. The api caches for five minutes, so a longer client stale time adds nothing; a refocus
 * refetch is wanted so a dismissal made on another device shows up.
 *
 * The caller derives its state with `ideasFeedStatus` (lib/studio.ts), never from `isLoading`: a paused (offline) query is not loading,
 * and a refetch clears `error` on a query that holds no data.
 */
export function usePostIdeas() {
  const { isAuthenticated, org, business } = useAuth();
  return useQuery<PostIdeasResponse>({
    queryKey: [STUDIO_KEYS.ideas, org?._id ?? null, business?._id ?? null],
    queryFn: () => creativeApi.postIdeas(),
    enabled: isAuthenticated && !!org?._id && !!business?._id,
    staleTime: 60_000,
    retry: false,
  });
}

/**
 * What Studio may do right now, and the per-user Pro tools flag, from `GET /v1/creative/studio/availability`.
 *
 * DEFENSIVE: until the api answers, and whenever it cannot (not deployed yet, failed, unreadable) this returns {@link UNAVAILABLE}:
 * every AI capability "coming soon", Pro tools off. It never returns an error and never an `on` the api did not send.
 */
export function useStudioAvailability(): StudioAvailability & { loading: boolean } {
  const { isAuthenticated, org, business } = useAuth();
  const q = useQuery<StudioAvailability>({
    queryKey: [STUDIO_KEYS.availability, org?._id ?? null, business?._id ?? null],
    queryFn: () => creativeApi.availability(),
    enabled: isAuthenticated && !!org?._id && !!business?._id,
    staleTime: 60_000,
    retry: false,
  });
  // Until there is data the safe answer is UNAVAILABLE. `loading` is true only while a request is really in flight (a disabled or paused
  // query is pending for ever, so `isPending` alone would never let a screen leave its skeleton); the Pro tools gate waits on it
  // rather than flash "off".
  return { ...(q.data ?? UNAVAILABLE), loading: q.isPending && q.fetchStatus === "fetching" };
}

/** The per-user "Pro tools" flag. Off by default and whenever the api cannot say. */
export function useStudioPrefs(): { proTools: boolean; loading: boolean } {
  const { proTools, loading } = useStudioAvailability();
  return { proTools, loading };
}
