"use client";

import { Button } from "@/components/ui/button";
import { OUTCOME_FAILED_NOTE, OUTCOME_OLDER_NOTE, outcomeWords, type OutcomeSlot } from "@/lib/presence-edit";

/**
 * What followed a live change (PE-13), under its card. MARKUP ONLY: the words are the api's, the headline is `outcomeWords`'s, and the slot comes
 * from the one request the list's owner makes (`useChangeOutcomes`), never from this component.
 *
 * It draws nothing when the card does not ask or the answer has not come. A live change past the newest ten says so (it is not "no figures"),
 * and a failed read says so with a way to try again. Never a number that was not compared, and never a claim that the change caused anything.
 */
export function ChangeOutcome({ slot }: { slot: OutcomeSlot | null | undefined }) {
  if (!slot || slot.kind === "none") return null;
  if (slot.kind === "older") {
    return (
      <p className="text-xs text-muted-foreground" data-testid="change-outcome-older">
        {OUTCOME_OLDER_NOTE}
      </p>
    );
  }
  if (slot.kind === "failed") {
    return (
      <div className="flex items-center gap-2" data-testid="change-outcome-failed">
        <p className="text-xs text-muted-foreground">{OUTCOME_FAILED_NOTE}</p>
        <Button size="sm" variant="outline" onClick={slot.retry}>
          Try again
        </Button>
      </div>
    );
  }
  const words = outcomeWords(slot.item);
  if (!words) return null;
  return (
    <div className="space-y-1 rounded-md bg-muted/40 p-3" data-testid="change-outcome">
      <p className="text-sm font-medium">{words.headline}</p>
      <p className="text-xs text-muted-foreground">{words.message}</p>
      {words.lines.length > 0 && (
        <ul className="space-y-0.5 text-xs">
          {words.lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
