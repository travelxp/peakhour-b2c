"use client";

import { PillarError } from "@/components/dashboard/pillar-error";

export default function StudioError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PillarError href="/dashboard/studio" {...props} />;
}
