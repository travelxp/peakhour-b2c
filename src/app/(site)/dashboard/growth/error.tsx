"use client";

import { PillarError } from "@/components/dashboard/pillar-error";

export default function GrowthError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PillarError area="Growth" {...props} />;
}
