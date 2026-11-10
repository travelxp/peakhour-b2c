"use client";

import { PillarError } from "@/components/dashboard/pillar-error";

export default function InboxError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <PillarError area="Inbox" {...props} />;
}
