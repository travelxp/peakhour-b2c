"use client";

import type { Money } from "@/lib/api/growth-v2";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ToneBadge } from "./tone";

/**
 * MR-G5: a channel or campaign billed in another currency than the plan is information, not a problem. A small neutral
 * badge ("Billed in USD"). It never claims a conversion that did not happen: the tooltip is derived from the row's own
 * figure (`money`), so a missing rate says "Can't convert USD yet", a partial figure says what is not counted, and the Rules
 * screen (which shows no spend) only says where the converted spend is shown. With no plan currency there is no label.
 * One true limit stays in every tooltip: Peakhour does not move budget between currencies.
 */
export type BilledInSurface = "channel" | "campaign" | "rules";

const NO_MOVE = "Peakhour does not move budget between currencies.";

export function billedInTip(a: { billedIn?: string; planCurrency: string; money?: Money; surface: BilledInSurface; currencyNotRecorded?: boolean; note?: string }): string | undefined {
  const { billedIn, planCurrency: plan, money, surface } = a;
  if (!plan) return undefined;
  if (!billedIn) return a.currencyNotRecorded ? `This has no recorded currency, so its spend is counted at face value in ${plan}, not converted. ${NO_MOVE}` : undefined;
  if (surface === "rules") return `Billed in ${billedIn}. Spend is converted into ${plan} on the Channels page where Peakhour has an exchange rate. ${NO_MOVE}`;
  const noRate = money !== undefined && "absent" in money && money.absent === "no_exchange_rate";
  if (noRate) return `Peakhour has no exchange rate for ${billedIn} yet, so this spend is not shown in ${plan}. ${NO_MOVE}`;
  const partial = money !== undefined && "value" in money && money.leftOut && money.leftOut.length > 0 ? ` Part of the spend, in ${money.leftOut.join(", ")}, is not counted yet.` : "";
  if (surface === "campaign") return `Spend is shown in ${plan} at today's rate; budgets are in ${billedIn}. ${NO_MOVE}${partial}`;
  return `${a.note ?? `Shown in ${plan} at today's rate. ${NO_MOVE}`}${partial}`;
}

export function BilledInLabel(p: { billedIn?: string; planCurrency: string; money?: Money; currencyNotRecorded?: boolean; note?: string; surface?: BilledInSurface }) {
  const surface = p.surface ?? "channel";
  const tip = billedInTip({ ...p, surface });
  if (!tip) return null;
  const billedIn = p.billedIn?.trim().toUpperCase();
  const noRate = surface !== "rules" && p.money !== undefined && "absent" in p.money && p.money.absent === "no_exchange_rate";
  const text = !billedIn ? "Currency not recorded" : noRate ? `Can't convert ${billedIn} yet` : `Billed in ${billedIn}`;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" data-billed-in={billedIn ?? ""} className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <ToneBadge tone="neutral">{text}</ToneBadge>
          </button>
        </TooltipTrigger>
        <TooltipContent>{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
