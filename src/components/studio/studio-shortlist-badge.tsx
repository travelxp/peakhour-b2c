"use client";

import type { ReactNode } from "react";
import { useShortlistCount } from "@/hooks/use-studio-flow";
import { STUDIO_COPY } from "@/lib/studio-copy";

/**
 * How many previews are on the Studio shortlist: hearts waiting to be made final. Nothing when none. Its own module so the dashboard
 * layout loads it after first paint (the Studio hooks and copy stay out of every dashboard page's shared bundle).
 */
export function StudioShortlistBadge({ Badge }: { Badge: (p: { count: number; description: string }) => ReactNode }) {
  const { data: count } = useShortlistCount();
  if (!count) return null;
  return <Badge count={count} description={STUDIO_COPY.nav.shortlistCount(count)} />;
}
