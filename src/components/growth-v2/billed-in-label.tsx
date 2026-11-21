"use client";

import type { Money } from "@/lib/api/growth-v2";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToneBadge } from "./tone";

/**
 * MR-G5: a channel or campaign billed in another currency than the plan is information, not a problem. A small neutral
 * badge ("Billed in USD") that opens a short note on tap, Enter or Space (a toggletip, so touch and keyboard read it as
 * well as a mouse; Escape or a click outside closes it).
 *
 * It never claims a conversion that did not happen: `billedInLabelOf` is the ONE place the text and the note come from the
 * row, and it says "shown in INR at today's rate" only when the row's money is a value. With no plan currency, or nothing to
 * say, there is no label. One true limit stays in every note: Peakhour does not move budget between currencies.
 */
export type BilledInSurface = "channel" | "campaign" | "rules";

const NO_MOVE = "Peakhour does not move budget between currencies.";
const code = (c: string | undefined): string => (c ?? "").trim().toUpperCase();

export interface BilledInInput {
  billedIn?: string;
  planCurrency: string;
  money?: Money;
  currencyNotRecorded?: boolean;
  /** The campaigns' currencies could not be read just now: the label rests on the account alone, and says so. */
  unreadable?: boolean;
  /** The api's note for the row, used when the row's figure is converted. */
  note?: string;
  surface?: BilledInSurface;
}

/** The badge text and the note for a row, or null when there is nothing to say (no plan currency, nothing billed elsewhere). */
export function billedInLabelOf(a: BilledInInput): { text: string; tip: string } | null {
  const plan = code(a.planCurrency);
  const billed = code(a.billedIn);
  if (!plan) return null;
  const surface = a.surface ?? "channel";
  const money = a.money;
  const unrecorded = (a.currencyNotRecorded ? " Some of it has no recorded currency and is counted as is." : "") + (a.unreadable ? " Part of the campaign currencies could not be read just now." : "");
  if (!billed && a.unreadable && !a.currencyNotRecorded) return { text: "Billing currency unavailable", tip: `Peakhour could not read this channel's campaign currencies just now. ${NO_MOVE}` };
  if (!billed) {
    return a.currencyNotRecorded ? { text: "Currency not recorded", tip: `This has no recorded currency, so its spend is counted at face value in ${plan}, not converted. ${NO_MOVE}` } : null;
  }
  if (surface === "rules") {
    return { text: `Billed in ${billed}`, tip: `Billed in ${billed}. Spend is converted into ${plan} on the Channels page where Peakhour has an exchange rate. ${NO_MOVE}${unrecorded}` };
  }
  if (money !== undefined && "absent" in money && money.absent === "no_exchange_rate") {
    return { text: `Can't convert ${billed} yet`, tip: `Peakhour has no exchange rate for ${billed} yet, so this spend is not shown in ${plan}. ${NO_MOVE}${unrecorded}` };
  }
  // A conversion is claimed ONLY for a figure that is a value; any other absence says just what it is billed in.
  if (money === undefined || !("value" in money)) return { text: `Billed in ${billed}`, tip: `Billed in ${billed}. ${NO_MOVE}${unrecorded}` };
  const partial = money.leftOut && money.leftOut.length > 0 ? ` Part of the spend, in ${money.leftOut.map(code).join(", ")}, is not counted yet.` : "";
  const base = surface === "campaign" ? `Spend is shown in ${plan} at today's rate; budgets are in ${billed}. ${NO_MOVE}` : (a.note ?? `Shown in ${plan} at today's rate. ${NO_MOVE}`);
  // The api's note already names a partial figure; add the sentence only when the note is ours.
  return { text: `Billed in ${billed}`, tip: `${base}${a.note && surface === "channel" ? "" : partial}${unrecorded}` };
}

export function BilledInLabel(p: BilledInInput) {
  const label = billedInLabelOf(p);
  if (!label) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" data-billed-in={code(p.billedIn)} className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <ToneBadge tone="neutral">{label.text}</ToneBadge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 text-xs" role="note">
        {label.tip}
      </PopoverContent>
    </Popover>
  );
}
