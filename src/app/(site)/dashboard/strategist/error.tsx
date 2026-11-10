"use client";

import { PillarError } from "@/components/dashboard/pillar-error";

export default function StrategistError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PillarError href="/dashboard/strategist" {...props} />;
}
