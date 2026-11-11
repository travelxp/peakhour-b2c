"use client";

import { useNow } from "@/hooks/use-now";
import type { ChangeCardData } from "@/lib/presence-edit";
import { waitingLine } from "@/lib/presence-summary";

/**
 * GBP L7: the only trace of a request a section keeps. One short line, linking to the request's row in "Your requests", where the stage, the
 * reason and the buttons are. MARKUP ONLY: `waitingLine` decides whether anything is open for the field.
 */
export function WaitingLine({ changes, matches }: { changes: readonly ChangeCardData[] | undefined; matches: (c: Pick<ChangeCardData, "field" | "network">) => boolean }) {
  const now = useNow();
  const line = waitingLine(changes, now, matches);
  if (!line) return null;
  return (
    <p className="text-xs text-muted-foreground" data-testid="waiting-line">
      <a href={line.href} className="underline underline-offset-4">
        {line.text}
      </a>
    </p>
  );
}
