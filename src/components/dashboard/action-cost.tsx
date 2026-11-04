"use client";

import { useCreditsRateCard } from "@/hooks/use-credits";
import { actionCost, actionCostSentence, type ActionCost as Cost, type ActionCostKey } from "@/lib/action-cost";
import { cn } from "@/lib/utils";

/** The price of an action, read off the rate card. Safe to call in any component that renders a button. */
export function useActionCost(action: ActionCostKey): Cost {
  const card = useCreditsRateCard();
  return actionCost(card.data?.useCases, action, card.isError);
}

/**
 * "Costs 8 Peaks." beside the button that spends them, before it is pressed.
 *
 * The number is the rate card's (see `lib/action-cost.ts`); this component only
 * says it. While the card loads it says so, and when the card has no row for the
 * action it says where the price lives, rather than a number or a Free it does
 * not know.
 */
export function ActionCost({ action, className, unit }: { action: ActionCostKey; className?: string; unit?: string }) {
  const cost = useActionCost(action);
  return (
    <span className={cn("text-muted-foreground", className)} data-action-cost={action} data-cost-state={cost.state}>
      {actionCostSentence(cost, unit)}
    </span>
  );
}
