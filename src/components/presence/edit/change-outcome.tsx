"use client";

import { outcomeWords } from "@/lib/presence-edit";
import { useChangeOutcome } from "@/hooks/use-presence-edit";

/**
 * What followed a live change (PE-13), under its card. MARKUP ONLY: the words are the api's (`outcomeWords` adds a headline).
 *
 * It is asked for only when the change is live, and draws nothing while it loads, when it fails, for a network that declares no figures,
 * or when there is nothing to say. Never a number that was not compared, and never a claim that the change caused anything.
 */
export function ChangeOutcome({ changeId, live }: { changeId: string; live: boolean }) {
  const q = useChangeOutcome(changeId, live);
  const words = outcomeWords(q.data);
  if (!live || !words) return null;
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
