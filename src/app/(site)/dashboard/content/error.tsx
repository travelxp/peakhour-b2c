"use client";

import { PillarError } from "@/components/dashboard/pillar-error";

export default function ContentError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PillarError area="Content" {...props} />;
}
