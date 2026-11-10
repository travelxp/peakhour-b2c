"use client";

import { PillarError } from "@/components/dashboard/pillar-error";

export default function DriveError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PillarError href="/dashboard/drive" {...props} />;
}
