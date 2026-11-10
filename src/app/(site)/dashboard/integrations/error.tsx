"use client";

import { PillarError } from "@/components/dashboard/pillar-error";

export default function IntegrationsError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PillarError href="/dashboard/integrations" {...props} />;
}
