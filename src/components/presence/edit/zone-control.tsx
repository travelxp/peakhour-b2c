"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePresenceEditMutations } from "@/hooks/use-presence-edit";
import { errorWords, zoneChoices, zoneLine, zoneWords, type ListingTimeZone } from "@/lib/presence-edit";

/**
 * The time zone a place's holiday days are placed in: one line saying where it came from (from the address, or from the business settings),
 * a Change button, and, when no zone is known at all, the picker itself in place of a dead end.
 *
 * It writes our own copy of the listing only. Nothing is sent to a network, so there is nothing to approve.
 */
export function ZoneControl({
  listingId,
  tz,
  country,
  city,
  message,
}: {
  listingId: string;
  /** The zone and who gave it; null when none is known (the picker is open from the start). */
  tz: ListingTimeZone | null;
  country?: string | null;
  city?: string | null;
  /** Words above the picker when no zone is known. */
  message?: string | null;
}) {
  const m = usePresenceEditMutations(listingId);
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<string>("");
  const editing = open || !tz;
  const line = zoneLine(tz, city);

  // Built only while the picker is on screen: a name for each of 400 zones is not free.
  const choices = useMemo(() => {
    if (!editing) return null;
    let supported: string[] = [];
    try {
      supported = Intl.supportedValuesOf("timeZone");
    } catch {
      supported = ["Asia/Kolkata", "Europe/London", "America/New_York", "America/Los_Angeles", "Australia/Sydney", "Pacific/Auckland", "Asia/Dubai"];
    }
    return zoneChoices(country, supported);
  }, [editing, country]);

  // The current zone is the seed only when the list holds it by that spelling (a legacy id is listed under today's name).
  const shown = pick && choices && (choices.near.includes(pick) || choices.all.includes(pick)) ? pick : "";

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {line && <p className="text-xs text-muted-foreground">{line}</p>}
        <Button size="sm" variant="outline" onClick={() => { m.setTimeZone.reset(); setPick(tz!.zone); setOpen(true); }}>
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{message ?? "Choose the time zone this place keeps, so holiday days land on the right date."}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={shown} onValueChange={setPick}>
          <SelectTrigger className="w-72" aria-label="Time zone">
            <SelectValue placeholder="Choose your time zone" />
          </SelectTrigger>
          <SelectContent>
            {choices && choices.near.length > 0 && (
              <SelectGroup>
                <SelectLabel>Where your business is</SelectLabel>
                {choices.near.map((z) => (
                  <SelectItem key={`near-${z}`} value={z}>
                    {zoneWords(z)}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            <SelectGroup>
              <SelectLabel>All time zones</SelectLabel>
              {(choices?.all ?? []).map((z) => (
                <SelectItem key={z} value={z}>
                  {zoneWords(z)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button size="sm" disabled={!pick || m.setTimeZone.isPending} onClick={() => m.setTimeZone.mutate({ listingId, timeZone: pick }, { onSuccess: () => setOpen(false) })}>
          Save time zone
        </Button>
        {tz && (
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
