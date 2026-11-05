"use client";

import { outcomeWords, type ChangeOutcomeItem } from "@/lib/presence-edit";

/**
 * What followed a live change (PE-13), under its card. MARKUP ONLY: the words are the api's, the headline is `outcomeWords`'s, and the answer
 * comes from the list's one request (`useChangeOutcomes`, owned by the card that lists the changes), never from this component.
 *
 * It draws nothing when there is no answer, or one it does not know the words for. Never a number that was not compared, and never a claim
 * that the change caused anything.
 */
export function ChangeOutcome({ outcome }: { outcome: ChangeOutcomeItem | null | undefined }) {
  const words = outcomeWords(outcome);
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
