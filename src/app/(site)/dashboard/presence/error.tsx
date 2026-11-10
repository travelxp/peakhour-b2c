"use client";

import { PillarError } from "@/components/dashboard/pillar-error";

export default function PresenceError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PillarError area="Presence" {...props} />;
}
