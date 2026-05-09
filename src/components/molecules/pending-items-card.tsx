import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * PendingItemsCard — a deliberate "what's coming, and what gates it"
 * placeholder. Use when a panel has a designed slot for content that
 * depends on a backend surface that hasn't shipped yet.
 *
 * Why this is a molecule and not a one-off: every analytics surface
 * eventually has telemetry that lags the UI (citations 30d, drift
 * alerts, hook DNA, audience signals). Naming each gate explicitly
 * lets a future reader pattern-match against followup trackers
 * instead of guessing what's missing.
 */

export interface PendingItem {
  /** Item title, e.g. "Citation timeline". */
  title: string;
  /** What backend or data surface gates this item, e.g. "cnt_source_usage
   *  time-series aggregate endpoint". The card prepends "Lands once the"
   *  and appends "ships." so callers should write the *thing* that needs
   *  to ship, not a full sentence. */
  gatedOn: string;
}

export interface PendingItemsCardProps {
  title?: string;
  items: PendingItem[];
}

export function PendingItemsCard({ title = "Coming soon", items }: PendingItemsCardProps) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        {items.map((item) => (
          <div key={item.title}>
            <p className="text-sm font-medium text-foreground">{item.title}</p>
            <p className="text-xs">Lands once the {item.gatedOn} ships.</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
