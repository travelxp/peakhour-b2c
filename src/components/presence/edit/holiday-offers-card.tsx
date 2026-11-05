"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useHolidayOffers, usePresenceEditMutations } from "@/hooks/use-presence-edit";
import { fetchView } from "@/lib/presence-panels";
import { errorWords, offerLine, offerOutcome, offerState, regionQuestion, type HolidayOffer } from "@/lib/presence-edit";

const SHOWN = 4;

/**
 * Holiday hours, offered ahead of time (PE-07, closes PE-08). A day your business's own calendar says shops commonly close.
 *
 * ★NOTHING IS CHANGED FROM HERE. "Prepare" makes a proposal that an admin approves; "No thanks" is remembered. A regional day we cannot place
 * asks first rather than guessing. Nothing renders until there is a day to offer, and a failed read is said, not hidden.
 */
export function HolidayOffersCard({ listingId, network, label }: { listingId: string; network: string; label: string }) {
  const q = useHolidayOffers(listingId, network);
  const m = usePresenceEditMutations(listingId);
  const [done, setDone] = useState<string | null>(null);
  const view = fetchView({ hasData: !!q.data, isPending: q.isPending, isError: q.isError, fetchStatus: q.fetchStatus });

  if (view === "loading" || view === "paused") return <p className="text-xs text-muted-foreground">{view === "paused" ? "Waiting for a connection to look for holidays." : "Looking for upcoming holidays..."}</p>;
  if (view === "failed" || !q.data) {
    return (
      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground">We could not look for upcoming holidays just now.</p>
        <Button size="sm" variant="outline" onClick={() => q.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  const state = offerState(q.data, label);
  if (!state.show) return null;
  // Nothing to offer, but a reason to say: a lone line, not a card with no days in it.
  if (q.data.offers.length === 0) return state.message ? <p className="text-xs text-muted-foreground">{state.message}</p> : null;

  const failure = m.acceptOffer.error ?? m.dismissOffer.error;
  const busy = m.acceptOffer.isPending || m.dismissOffer.isPending;

  function accept(o: HolidayOffer, confirmRegion: boolean) {
    setDone(null);
    m.acceptOffer.mutate(
      { listingId, network, date: o.date, ...(o.regionUnknown ? { confirmRegion } : {}) },
      { onSuccess: (r) => setDone(offerOutcome(r.items, o.name, label).message) },
    );
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-medium">Holiday hours to think about</h3>
        <p className="text-xs text-muted-foreground">
          Shops commonly close on these days. Preparing one makes a change for you to approve. Nothing is sent to {label} until you approve it.
        </p>
      </div>
      {view === "data_stale" && <p className="text-xs text-warning-on-tint">Could not refresh just now, so this may be out of date.</p>}
      {state.message && <p className="text-xs text-warning-on-tint">{state.message}</p>}
      <ul className="space-y-3">
        {q.data.offers.slice(0, SHOWN).map((o) => (
          <li key={o.key} className="space-y-1">
            <p className="text-sm">{offerLine(o)}</p>
            {o.regionUnknown && <p className="text-xs text-muted-foreground">{regionQuestion(o)}</p>}
            <div className="flex flex-wrap gap-2">
              {o.regionUnknown ? (
                <Button size="sm" disabled={busy || !state.canAccept} onClick={() => accept(o, true)}>
                  Yes, prepare a closed day
                </Button>
              ) : (
                <Button size="sm" disabled={busy || !state.canAccept} onClick={() => accept(o, false)}>
                  Prepare a closed day
                </Button>
              )}
              <Button size="sm" variant="outline" disabled={busy} onClick={() => {
                  setDone(null);
                  m.dismissOffer.mutate({ listingId, key: o.key }, { onSuccess: () => setDone(`${o.name} will not be suggested again.`) });
                }}>
                {o.regionUnknown ? "No, not for me" : "No thanks"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {q.data.offers.length > SHOWN && <p className="text-xs text-muted-foreground">{q.data.offers.length - SHOWN} more later.</p>}
      {failure ? <p className="text-xs text-destructive">{errorWords(failure)}</p> : null}
      {done && (
        <p role="status" className="text-xs text-muted-foreground">
          {done}
        </p>
      )}
    </div>
  );
}
