"use client";

import { useCreditsRateCard } from "@/hooks/use-credits";
import { actionCost, actionCostShort, actionCostSentence, type ActionCost as Cost, type ActionCostKey } from "@/lib/action-cost";
import { cn } from "@/lib/utils";

/** The price of an action, read off the rate card. Safe to call in any component that renders a button. */
export function useActionCost(action: ActionCostKey): Cost {
  const card = useCreditsRateCard();
  // "Loading" only while a request is really in flight. A query that is not running (signed out, auth not yet
  // hydrated, paused) with no data is not about to deliver a price, so it reads as "we cannot price this".
  const waiting = card.isPending && card.fetchStatus === "fetching";
  return actionCost(card.data?.useCases, action, card.isError || (!card.data && !waiting));
}

/** "8 Peaks" or "Free" on its own, for a label that already has its own sentence ("Draft reply · 8 Peaks"). Empty when unknown. */
export function ActionCostShort({ action, prefix = "" }: { action: ActionCostKey; prefix?: string }) {
  const text = actionCostShort(useActionCost(action));
  // The separator belongs to the price: with no price known there is nothing to separate.
  return text ? <>{prefix}{text}</> : null;
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
