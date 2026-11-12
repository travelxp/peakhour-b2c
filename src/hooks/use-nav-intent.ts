"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { createIntentScheduler, prefetchDestinationData, type PrefetchContext } from "@/lib/nav-prefetch";

export interface NavIntentProps {
  onMouseEnter: () => void;
  onFocus: () => void;
  onTouchStart: () => void;
  onMouseLeave: () => void;
  onBlur: () => void;
}

/**
 * Handlers to spread on a nav <Link prefetch={false}>: on hover, focus or
 * touchstart (after a 100ms debounce, skipped on Data Saver / 2g) they prefetch
 * the route code AND the destination's first query. See lib/nav-prefetch.ts.
 *
 * `prefetch={false}` on the link is what keeps a sidebar of ~40 links from
 * prefetching all of them when it scrolls into view.
 */
export function useNavIntent(): (href: string) => NavIntentProps {
  const router = useRouter();
  const qc = useQueryClient();
  const { org, business, isAuthenticated } = useAuth();
  const orgId = org?._id;
  const businessId = business?._id;

  const scheduler = useMemo(() => {
    const ctx: PrefetchContext = { orgId, businessId, isAuthenticated };
    return createIntentScheduler((href) => {
      router.prefetch(href);
      prefetchDestinationData(qc, href, ctx);
    });
  }, [router, qc, orgId, businessId, isAuthenticated]);

  return useMemo(
    () => (href: string) => ({
      onMouseEnter: () => scheduler.schedule(href),
      onFocus: () => scheduler.schedule(href),
      onTouchStart: () => scheduler.schedule(href),
      onMouseLeave: () => scheduler.cancel(href),
      onBlur: () => scheduler.cancel(href),
    }),
    [scheduler],
  );
}
