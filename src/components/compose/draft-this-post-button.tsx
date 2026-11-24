"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActionCost } from "@/components/dashboard/action-cost";
import { draftButtonState } from "@/lib/what-changed-view";
import type { ComposeChannel } from "@/lib/compose-channel";
import { useComposeSheet } from "./compose-sheet-provider";

/**
 * "Draft this post" on an insight that implies an action. It opens the page's one New post sheet on `channel`, and the composer writes a first draft
 * from `brief` with its own Compose action: the price is the rate card's price for that action, said on the button before it is pressed, and it is
 * charged when the draft arrives (the existing rewrite path). Only a draft: nothing is published or scheduled until the merchant does it.
 *
 * Must sit under a <ComposeSheetProvider/>.
 */
export function DraftThisPostButton({ channel, brief, className }: { channel: ComposeChannel; brief: string; className?: string }) {
  const sheet = useComposeSheet();
  const state = draftButtonState(useActionCost("composerRewrite"));
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={className ?? "gap-1.5"}
      disabled={!state.enabled}
      title={state.hint}
      onClick={() => sheet.open(channel, brief)}
    >
      <Sparkles className="size-3.5" aria-hidden /> {state.label}
    </Button>
  );
}
