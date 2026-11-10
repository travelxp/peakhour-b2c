"use client";

import { PillarError } from "@/components/dashboard/pillar-error";

export default function OverviewError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PillarError href="/dashboard/overview" {...props} />;
}
