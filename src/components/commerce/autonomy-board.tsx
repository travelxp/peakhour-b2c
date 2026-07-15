"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ConsentDial, AUTONOMY_LEVEL_META } from "@/components/commerce/consent-dial";
import {
  useCommerceAutonomy,
  useSetAutonomy,
  type AutonomyEntry,
  type AutonomyLevel,
} from "@/hooks/use-commerce-autonomy";

/**
 * Commerce → Autopilot autonomy board (the consent dial per agent × channel).
 * Reads GET /v1/commerce/autonomy and PUTs level changes optimistically. The
 * confidence meter (written by the P1.9 loop) drives the future graduation
 * invites; until measured it reads "not yet measured".
 */

/** Display copy for each agent (the api returns the raw agent key). */
const AGENT_META: Record<string, { name: string; description: string }> = {
  merchandiser: { name: "Merchandiser", description: "Listings, PDP copy, keywords & buy-box" },
  pricer: { name: "Pricer", description: "Price & promotions within your margin floor" },
  replenisher: { name: "Replenisher", description: "Availability & restock across locations" },
  concierge: { name: "Concierge", description: "The conversational assistant" },
  reputation: { name: "Reputation", description: "Reviews & drafted responses" },
  forecaster: { name: "Forecaster", description: "Demand & assortment — advises only" },
};

export function AutonomyBoard() {
  const { data, isLoading, isError } = useCommerceAutonomy();
  const setAutonomy = useSetAutonomy();

  if (isError) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Autonomy</CardTitle>
        <p className="text-sm text-muted-foreground">
          Set how much each agent can do on its own. The default is Recommend —
          autonomy is earned, and every autonomous action stays reversible.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
        ) : (
          data?.agents.map((agent) => (
            <AgentRow
              key={agent.agent}
              entry={agent}
              busy={setAutonomy.isPending && setAutonomy.variables?.agent === agent.agent}
              onSet={(level) =>
                setAutonomy.mutate({ agent: agent.agent, channel: data.channel, level })
              }
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function AgentRow({
  entry,
  busy,
  onSet,
}: {
  entry: AutonomyEntry;
  busy: boolean;
  onSet: (level: AutonomyLevel) => void;
}) {
  const meta = AGENT_META[entry.agent] ?? { name: entry.agent, description: "" };
  const hint = AUTONOMY_LEVEL_META.find((m) => m.value === entry.level)?.hint;
  const conf = entry.confidence;
  const confidencePct = conf ? Math.round(conf.score * 100) : null;

  return (
    <div className="flex flex-col gap-3 border-b pb-5 last:border-b-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">{meta.name}</p>
        {meta.description && (
          <p className="text-xs text-muted-foreground">{meta.description}</p>
        )}
        {confidencePct !== null ? (
          <div className="mt-2 flex items-center gap-2">
            <Progress value={confidencePct} className="h-1.5 w-24" />
            <span className="text-xs tabular-nums text-muted-foreground">
              {confidencePct}% confidence
            </span>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Confidence — not yet measured</p>
        )}
      </div>
      <div className="shrink-0 sm:text-right">
        <ConsentDial level={entry.level} disabled={busy} onChange={onSet} />
        {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
