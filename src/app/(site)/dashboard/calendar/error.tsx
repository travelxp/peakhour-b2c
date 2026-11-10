"use client";

import { PillarError } from "@/components/dashboard/pillar-error";

export default function CalendarError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PillarError area="Calendar" {...props} />;
}
