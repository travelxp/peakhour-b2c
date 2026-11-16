"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { browserZone, searchZones, zoneGroups, zoneLabel } from "@/lib/time-zones";
import { cn } from "@/lib/utils";

/** How many of the rest are drawn at once: a name for each of 400 zones in a list is slow to open, and a search finds the rest. */
const MAX_LISTED = 60;

/** The value an extra first option chooses: no zone of its own, such as "Your business's time zone". */
export const FIRST_OPTION_VALUE = "";

/**
 * The one searchable time-zone picker (FR2), on the shared Command and Popover. Search by city, region, country or offset ("Kolkata",
 * "India", "+05:30"); every label shows the offset; the browser's zone is suggested first.
 *
 * ★ONLY A ZONE IN THE LIST (OR THE STORED ONE) CAN BE CHOSEN. Typing narrows the list and never becomes the value, so a free-text zone cannot
 *  be submitted from here. The stored value is always an option, shown as stored even when the list holds only its modern name.
 * ★`firstOption` is the caller's own first choice (guardrails' "Your business's time zone"); choosing it gives `FIRST_OPTION_VALUE` (an
 *  empty string), which is also what `value` is when it is the one in force.
 */
export function TimeZoneCombobox({
  value,
  onChange,
  id,
  ariaLabel,
  placeholder = "Choose a time zone",
  firstOption,
  near,
  keep,
  className,
  disabled,
}: {
  value: string;
  onChange: (zone: string) => void;
  /** On the trigger, so a `<Label htmlFor>` names it. */
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
  firstOption?: { label: string };
  /** Zones to list under their own heading before the rest (a listing's country). */
  near?: readonly string[];
  /** Another zone to keep offered besides the value (the one a form was opened with, once the value has moved on). */
  keep?: string | undefined;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Built while the picker is open: a name for each of 400 zones is not free.
  const groups = useMemo(() => (open ? zoneGroups({ stored: value, keep: [keep], browser: browserZone(), ...(near ? { near } : {}) }) : []), [open, value, near, keep]);
  const found = useMemo(() => searchZones(groups, query), [groups, query]);
  const total = found.reduce((n, g) => n + g.items.length, 0);
  // the pinned groups (the stored zone, the detected one, those near) are always whole; the long tail is cut
  const pinned = found.reduce((n, g) => n + (g.key === "all" ? 0 : g.items.length), 0);
  const room = Math.max(MAX_LISTED - pinned, 20);
  const shown = useMemo(() => found.map((g) => (g.key === "all" ? { ...g, items: g.items.slice(0, room) } : g)), [found, room]);
  const cut = total - shown.reduce((n, g) => n + g.items.length, 0);
  const q = query.trim().toLowerCase();
  const showFirst = !!firstOption && (q === "" || firstOption.label.toLowerCase().includes(q));

  const pick = (zone: string) => {
    onChange(zone);
    setOpen(false);
    setQuery("");
  };
  const triggerText = value ? zoneLabel(value) : firstOption ? firstOption.label : placeholder;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className={cn("truncate", !value && !firstOption && "text-muted-foreground")}>{triggerText}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-72 p-0" align="start" aria-label="Time zones">
        <Command shouldFilter={false} label="Time zones">
          <CommandInput placeholder="Search by city, country or +05:30" aria-label="Search time zones" value={query} onValueChange={setQuery} />
          <CommandList>
            {!showFirst && shown.length === 0 && <CommandEmpty>No time zone matches that.</CommandEmpty>}
            {showFirst && (
              <CommandGroup>
                <CommandItem value="__first__" onSelect={() => pick(FIRST_OPTION_VALUE)}>
                  <Check className={cn("mr-2 h-4 w-4", value === FIRST_OPTION_VALUE ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                  {firstOption.label}
                </CommandItem>
              </CommandGroup>
            )}
            {shown.map((g) => (
              <CommandGroup key={g.key} heading={g.heading}>
                {g.items.map((i) => (
                  <CommandItem key={i.value} value={i.value} onSelect={() => pick(i.value)}>
                    <Check className={cn("mr-2 h-4 w-4 shrink-0", value === i.value ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                    <span className="truncate">{i.label}</span>
                    {i.place ? <span className="ml-auto pl-2 text-xs text-muted-foreground">{i.place}</span> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            {cut > 0 && <p className="px-3 py-2 text-xs text-muted-foreground">{cut} more. Type a city, country or offset to narrow the list.</p>}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
