"use client";

import { Button } from "@/components/ui/button";
import { useEditCapabilities, useKeepNetworkChange, usePresenceEditMutations } from "@/hooks/use-presence-edit";
import { capabilityFor, errorWords } from "@/lib/presence-edit";
import { putBackValue, type ChangeLine, type PresenceListing, type PresenceNetworkEntry } from "@/lib/presence-panels";

/**
 * The two things a person can do about a change the network made by itself: put theirs back, or keep the network's version.
 *
 * MARKUP ONLY. The words and the value to put back are in `lib/presence-panels.ts`.
 * ★PUT MINE BACK IS AN ORDINARY PROPOSED CHANGE, not a write: it is checked, then a person approves it under "Change your listing", like any
 * other change. KEEP asks the api to stop reminding and, for a name, description, phone number or website, to take the network's value
 * into the listing. Neither sends anything to the network on its own.
 */
export function ChangeChoices({ line, entry, listing, onDone }: { line: ChangeLine; entry: PresenceNetworkEntry; listing: PresenceListing; onDone: (words: string) => void }) {
  const caps = useEditCapabilities();
  const m = usePresenceEditMutations(listing.id);
  const keep = useKeepNetworkChange();
  const label = entry.label;

  // A viewer is offered nothing: the api refuses them, and a button that fails is not offered.
  if (!caps.data?.can.propose) return null;
  const cap = capabilityFor(caps.data, entry.network);
  const value = line.canPutBack ? putBackValue({ field: line.field, before: line.before }, listing) : null;
  const canPutBack = value !== null && !!cap?.writableFields.includes(line.field);
  const busy = m.propose.isPending || keep.isPending;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        {canPutBack && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              onDone("");
              m.propose.mutate(
                { listingId: listing.id, network: entry.network, changes: [{ field: line.field as never, value }] },
                { onSuccess: () => onDone("Prepared. Review it under Change your listing, then approve it. Nothing is sent until then.") },
              );
            }}
          >
            Put mine back
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            onDone("");
            keep.mutate(
              { listingId: listing.id, network: entry.network, field: line.field, label: line.path, externalId: entry.externalId ?? undefined, suggested: line.suggested },
              { onSuccess: () => onDone(`Done. We keep ${label}'s version and will stop reminding you about this.`) },
            );
          }}
        >
          Keep {label}&apos;s version
        </Button>
      </div>
      {(m.propose.isError || keep.isError) && (
        <p role="alert" className="text-destructive">
          {errorWords(m.propose.error ?? keep.error)}
        </p>
      )}
    </div>
  );
}
