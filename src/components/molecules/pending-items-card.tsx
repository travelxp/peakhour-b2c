import { Card, CardContent, CardHeader } from "@/components/ui/card";

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
 *
 * Each item supplies either:
 *   • `gateNoun` — a noun phrase the molecule splices into the
 *     templated sentence "Lands once the {gateNoun} ships." Use this
 *     for the common case (an endpoint, scorer, cron, etc.).
 *   • `caption` — a full sentence rendered verbatim. Use this when
 *     the templated sentence reads awkwardly (passive voice, future
 *     tense, multi-clause). Caption wins if both are provided.
 */

export type PendingItem = { title: string } & (
  | { gateNoun: string; caption?: never }
  | { caption: string; gateNoun?: never }
);

export interface PendingItemsCardProps {
  title?: string;
  items: PendingItem[];
}

export function PendingItemsCard({ title = "Coming soon", items }: PendingItemsCardProps) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        {/* Real <h3> for SR navigation — see ranked-list-card.tsx
            for the rationale. Tokens mirror CardTitle's defaults. */}
        <h3 className="text-base leading-none font-semibold">{title}</h3>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        {items.map((item) => (
          <div key={item.title}>
            <p className="text-sm font-medium text-foreground">{item.title}</p>
            <p className="text-xs">
              {item.caption ?? `Lands once the ${item.gateNoun} ships.`}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
