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
export function ChangeChoices({
  line,
  entry,
  listing,
  mapHref,
  onDone,
}: {
  line: ChangeLine;
  entry: PresenceNetworkEntry;
  listing: PresenceListing;
  /** The listing's page on the network, when known. */
  mapHref?: string | null;
  onDone: (words: string) => void;
}) {
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
  const keepMutation = () => {
    onDone("");
    m.propose.reset();
    return keep.mutateAsync({ listingId: listing.id, network: entry.network, field: line.field, label: line.path, externalId: entry.externalId ?? undefined, suggested: line.suggested });
  };
  const link = mapHref ? (
    <a href={mapHref} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
      {line.unnamed ? `Check it on ${label}` : `See it on ${label}`}
    </a>
  ) : null;

  // ★A CHANGE WE CANNOT NAME IS NEVER OFFERED FOR APPROVAL: no "Keep", no "Put mine back". The merchant looks at the network and says so. This asks the api to
  // stop reminding and takes no value into the listing (the api acknowledges an unnamed change and writes nothing else).
  if (line.unnamed) {
    return (
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          {link}
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              keepMutation()
                .then(() => onDone("Done. We will stop reminding you about this."))
                .catch(() => undefined);
            }}
          >
            I&apos;ve checked it
          </Button>
        </div>
        {keep.isError && (
          <p role="alert" className="text-destructive">
            {errorWords(keep.error)}
          </p>
        )}
      </div>
    );
  }
  // "Keep" only where the merchant can see what they are keeping: a value, or a named field with a link to look at.
  const canKeep = line.suggested !== undefined || !!mapHref;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        {canPutBack && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              onDone("");
              keep.reset();
              // `.then`, not a per-call onSuccess: that is skipped once the row has gone
              m.propose
                .mutateAsync({ listingId: listing.id, network: entry.network, changes: [{ field: line.field as never, value }] })
                .then(() => onDone("Prepared. Review it under Change your listing, then approve it. Nothing is sent until then."))
                .catch(() => undefined); // the error is shown from the mutation's own state
            }}
          >
            Put mine back
          </Button>
        )}
        {canKeep && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              keepMutation()
                .then(() => onDone(`Done. We keep ${label}'s version and will stop reminding you about this.`))
                .catch(() => undefined);
            }}
          >
            Keep {label}&apos;s version
          </Button>
        )}
        {link}
      </div>
      {(m.propose.isError || keep.isError) && (
        <p role="alert" className="text-destructive">
          {errorWords(m.propose.error ?? keep.error)}
        </p>
      )}
    </div>
  );
}
