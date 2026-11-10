"use client";

import { PillarError } from "@/components/dashboard/pillar-error";

export default function SettingsError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PillarError href="/dashboard/settings" {...props} />;
}
