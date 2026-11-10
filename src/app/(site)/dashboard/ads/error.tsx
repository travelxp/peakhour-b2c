"use client";

import { PillarError } from "@/components/dashboard/pillar-error";

export default function AdsError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PillarError area="Ads" {...props} />;
}
