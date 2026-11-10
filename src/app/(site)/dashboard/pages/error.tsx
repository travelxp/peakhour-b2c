"use client";

import { PillarError } from "@/components/dashboard/pillar-error";

export default function PagesError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PillarError area="Pages" {...props} />;
}
