"use client";

import { PillarError } from "@/components/dashboard/pillar-error";

export default function InsightsError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PillarError href="/dashboard/insights/analytics" {...props} />;
}
