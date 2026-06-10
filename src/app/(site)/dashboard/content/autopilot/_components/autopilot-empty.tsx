"use client";

import Link from "next/link";
import { Rocket, Plug } from "lucide-react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";

/**
 * Cold-start state — a brand-new business with no connected channels and
 * no history. Critical UX: a wall of empty graphs reads as "broken". This
 * frames the moment as "your autopilot is warming up" with one clear next
 * action, so the first impression is momentum, not emptiness.
 */
export function AutopilotEmpty() {
  return (
    <Empty className="rounded-xl border border-dashed py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Rocket className="size-6" />
        </EmptyMedia>
        <EmptyTitle>Your autopilot is warming up</EmptyTitle>
        <EmptyDescription>
          Connect your first channel and the engine starts drafting, scheduling,
          and surfacing what needs your approval — right here.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link href="/dashboard/integrations">
            <Plug className="size-4" />
            Connect a channel
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
