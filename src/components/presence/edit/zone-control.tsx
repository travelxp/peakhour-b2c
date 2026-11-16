"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { TimeZoneCombobox } from "@/components/ui/time-zone-combobox";
import { usePresenceEditMutations } from "@/hooks/use-presence-edit";
import { errorWords, zoneChoices, zoneLine, zoneRowLine, type ListingTimeZone } from "@/lib/presence-edit";
import { supportedZones } from "@/lib/time-zones";

/**
 * The time zone a place keeps its calendar in: one line saying where it came from (from the address, or from the business settings),
 * a Change button, and the picker. ONE component for both places it appears: the holiday card (`variant="holiday"`: when no zone is known the
 * picker is open from the start, in place of a dead end) and the listing card's quiet row (`variant="row"`: always there, "not set [Choose]").
 * `canChange` is false unless a caller says so (the route is an admin's): the line is drawn and no button.
 *
 * It writes our own copy of the listing only. Nothing is sent to a network, so there is nothing to approve.
 */
export function ZoneControl({
  listingId,
  tz,
  address,
  message,
  variant = "holiday",
  canChange = false,
}: {
  listingId: string;
  /** The zone and who gave it; null when none is known. */
  tz: ListingTimeZone | null;
  /** The listing's address: its country puts the right zones first and its city names where the zone came from. */
  address?: { city?: string | null | undefined; country?: string | null | undefined } | null | undefined;
  /** Words above the picker when no zone is known. */
  message?: string | null;
  variant?: "holiday" | "row";
  canChange?: boolean;
}) {
  const country = address?.country;
  const city = address?.city;
  const m = usePresenceEditMutations(listingId);
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<string>("");
  // The holiday card opens the picker when no zone is known; the row waits for "Choose". Nobody who cannot change it is shown a picker.
  const editing = canChange && (open || (variant === "holiday" && !tz));
  const row = variant === "row";
  const line = row ? zoneRowLine(tz, city) : zoneLine(tz, city);

  // The zones nearest the listing's country go first; the picker lists the rest. Built only while the picker is on screen.
  const near = useMemo(() => (editing ? zoneChoices(country, supportedZones()).near : []), [editing, country]);

  if (!editing) {
    // Nothing to say and nothing to press: no empty box in the card.
    if (!line && !(canChange) && !(!tz && message)) return null;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {(line ?? (!tz ? message : null)) && <p className="text-xs text-muted-foreground">{line ?? message}</p>}
        {canChange && (
          <Button size="sm" variant="outline" onClick={() => { m.setTimeZone.reset(); setPick(""); setOpen(true); }}>
            {tz ? "Change" : "Choose"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{message ?? "Choose the time zone this place keeps, so holiday days land on the right date."}</p>
      <div className="flex flex-wrap items-center gap-2">
        <TimeZoneCombobox
          ariaLabel="Time zone"
          className="w-72"
          placeholder="Choose your time zone"
          value={pick}
          near={near}
          onChange={(z) => {
            m.setTimeZone.reset();
            setPick(z);
          }}
        />
        <Button size="sm" disabled={!pick || m.setTimeZone.isPending} onClick={() => m.setTimeZone.mutate({ listingId, timeZone: pick }, { onSuccess: () => setOpen(false) })}>
          Save time zone
        </Button>
        {(tz || row) && (
          <Button size="sm" variant="outline" disabled={m.setTimeZone.isPending} onClick={() => { m.setTimeZone.reset(); setPick(""); setOpen(false); }}>
            Cancel
          </Button>
        )}
      </div>
      {m.setTimeZone.isError && (
        <p role="alert" className="text-xs text-destructive">
          {errorWords(m.setTimeZone.error)}
        </p>
      )}
    </div>
  );
}
