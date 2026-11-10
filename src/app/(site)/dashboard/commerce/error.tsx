"use client";

import { PillarError } from "@/components/dashboard/pillar-error";

export default function CommerceError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PillarError area="Commerce" {...props} />;
}
