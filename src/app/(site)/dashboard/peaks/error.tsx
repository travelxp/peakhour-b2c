"use client";

import { PillarError } from "@/components/dashboard/pillar-error";

export default function PeaksError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PillarError area="Peaks" {...props} />;
}
