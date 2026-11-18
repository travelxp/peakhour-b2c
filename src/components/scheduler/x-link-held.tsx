"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { scheduler } from "@/lib/scheduler/client";
import { useXPosting } from "@/components/integrations/x-posting-card";
import { HELD_COPY, heldChoiceLabels, xPostingErrorMessage } from "@/lib/x-posting";

/** Is this scheduled item an X post held for its link? */
export const isHeldForLink = (item: { channel: string; status: string; attempts?: Array<{ errorCode?: string }> }, code: string): boolean =>
  item.channel === "x" && item.status === "needs_action" && item.attempts?.at(-1)?.errorCode === code;

interface ViewProps {
  /** Peaks for a post with a link, from the rate card; null = not set. */
  linkPeaks: number | null;
  busy: boolean;
  error: string | null;
  onChoose: (choice: "without_link" | "with_link") => void;
}

/** The two choices on a held X post. Nothing has been edited or sent until one is picked. */
export function XLinkHeldView({ linkPeaks, busy, error, onChoose }: ViewProps) {
  const labels = heldChoiceLabels(linkPeaks);
  return (
    <div data-testid="x-link-held">
      <div className="font-medium">{HELD_COPY.title}</div>
      <p className="mt-0.5">{HELD_COPY.body}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onChoose("without_link")}>
          {labels.without}
        </Button>
        <Button size="sm" disabled={busy || linkPeaks === null} title={linkPeaks === null ? "The price is not available right now" : undefined} onClick={() => onChoose("with_link")}>
          {labels.with}
        </Button>
      </div>
      <p className="mt-1">{HELD_COPY.withNote}</p>
      {error ? (
        <p role="alert" className="mt-1 text-destructive" data-testid="x-link-held-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function XLinkHeld({ itemId, onChanged }: { itemId: string; onChanged: () => void }) {
  const posting = useXPosting();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // after a choice the buttons stay off until the drawer has re-read the item and this block goes away; a failed choice turns them back on
  const [chosen, setChosen] = useState(false);

  async function choose(choice: "without_link" | "with_link") {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await scheduler.resolveXLink(itemId, choice);
      setChosen(true);
      onChanged();
    } catch (err) {
      setError(xPostingErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return <XLinkHeldView linkPeaks={posting.data?.prices.link ?? null} busy={busy || chosen} error={error} onChoose={(c) => void choose(c)} />;
}
