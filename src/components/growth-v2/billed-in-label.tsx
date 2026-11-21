import { ToneBadge } from "./tone";

/**
 * MR-G5: a channel or campaign billed in another currency than the plan is information, not a problem. A small neutral
 * badge ("Billed in USD"); the spend beside it is already converted into the plan's currency by the api. The tooltip says
 * the one true limit. With no exchange rate the spend is absent and the label says it cannot convert yet.
 */
export function BilledInLabel({ billedIn, planCurrency, noRate = false }: { billedIn: string | undefined; planCurrency: string; noRate?: boolean }) {
  if (!billedIn) return null;
  const tip = noRate
    ? `Peakhour has no exchange rate for ${billedIn} yet, so its spend is not shown in ${planCurrency}. Peakhour does not move budget between currencies.`
    : `Shown in ${planCurrency} at today's rate. Peakhour does not move budget between currencies.`;
  return (
    <span title={tip} data-billed-in={billedIn}>
      <ToneBadge tone="neutral">{noRate ? `Can't convert ${billedIn} yet` : `Billed in ${billedIn}`}</ToneBadge>
      <span className="sr-only">. {tip}</span>
    </span>
  );
}
