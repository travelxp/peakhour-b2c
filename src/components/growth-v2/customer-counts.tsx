import type { LearningResponse } from "@/lib/api/growth-v2";
import { formatCount } from "@/lib/growth-v2-figure";

type Shoppers = NonNullable<LearningResponse["shoppers"]>;

/** "Customers: 120 new, 40 repeat, 12 loyal, 9 at risk of lapsing" (GG-3d). */
export function customerWords(c: NonNullable<Shoppers["customers"]>): string {
  return `Customers: ${formatCount(c.new)} new, ${formatCount(c.repeat)} repeat, ${formatCount(c.loyal)} loyal, ${formatCount(c.lapsing)} at risk of lapsing`;
}

/** "Shoppers close to buying who didn't: 8 this week" (GG-3d). A window that is not a week says its days. */
export function closeToBuyingWords(b: NonNullable<Shoppers["closeToBuying"]>): string {
  return `Shoppers close to buying who didn't: ${formatCount(b.count)} ${b.windowDays === 7 ? "this week" : `in the last ${b.windowDays} days`}`;
}

/** The two lines of counts, or what is missing. Counts only: there is no list of people behind them to show. */
export function CustomerCounts({ shoppers }: { shoppers: Shoppers }) {
  return (
    <div className="grid gap-1 text-sm">
      {shoppers.customers ? <p>{customerWords(shoppers.customers)}</p> : <p className="text-muted-foreground">No orders from customers to count yet.</p>}
      {shoppers.closeToBuying ? <p>{closeToBuyingWords(shoppers.closeToBuying)}</p> : <p className="text-muted-foreground">No shopper activity from your store to count yet.</p>}
      <p className="text-xs text-muted-foreground">Counted on {shoppers.asOf}.</p>
    </div>
  );
}
