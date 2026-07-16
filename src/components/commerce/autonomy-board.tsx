"use client";

import { ArrowUpCircle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ConsentDial, AUTONOMY_LEVEL_META } from "@/components/commerce/consent-dial";
import {
  useCommerceAutonomy,
  useSetAutonomy,
  useSetKillSwitch,
  useDismissGraduation,
  type AutonomyEntry,
  type AutonomyLevel,
} from "@/hooks/use-commerce-autonomy";

const LEVEL_LABEL: Record<AutonomyLevel, string> = {
  observe: "Observe",
  recommend: "Recommend",
  approve: "Approve",
  autonomous: "Autonomous",
};

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
  const setKillSwitch = useSetKillSwitch();
  const dismiss = useDismissGraduation();

  if (isError) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Autonomy</CardTitle>
        <p className="text-sm text-muted-foreground">
          Set how much each agent can do on its own. The default is Recommend —
          autonomy is earned, and every autonomous action stays reversible.
        </p>
        {data && (
          <div
            className={`mt-3 flex items-center justify-between gap-3 rounded-lg border p-3 ${
              data.killSwitch ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40" : ""
            }`}
          >
            <div className="flex items-start gap-2">
              <ShieldAlert className={`mt-0.5 size-4 ${data.killSwitch ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} />
              <div>
                <p className="text-sm font-medium">Kill switch</p>
                <p className="text-xs text-muted-foreground">
                  {data.killSwitch
                    ? "Execution is halted — no agent can ship. Proposals and drafts still work."
                    : "Emergency brake. Turn on to halt all agent execution instantly."}
                </p>
              </div>
            </div>
            <Switch
              checked={data.killSwitch}
              disabled={setKillSwitch.isPending}
              aria-label="Kill switch"
              onCheckedChange={(on) =>
                setKillSwitch.mutate(on, {
                  onSuccess: () =>
                    toast.success(on ? "Kill switch on — execution halted" : "Kill switch off"),
                  onError: () => toast.error("Couldn't update the kill switch"),
                })
              }
            />
          </div>
        )}
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
              onGraduate={(level) =>
                setAutonomy.mutate(
                  { agent: agent.agent, channel: data.channel, level },
                  {
                    onSuccess: () =>
                      toast.success(`${AGENT_META[agent.agent]?.name ?? agent.agent} raised to ${LEVEL_LABEL[level]}`),
                    onError: () => toast.error("Couldn't raise autonomy — please try again"),
                  },
                )
              }
              onDismiss={() => dismiss.mutate({ agent: agent.agent, channel: data.channel })}
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
  onGraduate,
  onDismiss,
}: {
  entry: AutonomyEntry;
  busy: boolean;
  onSet: (level: AutonomyLevel) => void;
  onGraduate: (level: AutonomyLevel) => void;
  onDismiss: () => void;
}) {
  const meta = AGENT_META[entry.agent] ?? { name: entry.agent, description: "" };
  const hint = AUTONOMY_LEVEL_META.find((m) => m.value === entry.level)?.hint;
  const conf = entry.confidence;
  const confidencePct = conf ? Math.round(conf.score * 100) : null;

  return (
    <div className="border-b pb-5 last:border-b-0 last:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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

      {/* Earned graduation invite — the merchant opts in, never auto-raised. */}
      {entry.graduation && (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <ArrowUpCircle className="mt-0.5 size-4 text-emerald-600 dark:text-emerald-400" />
            <p className="text-xs">
              <span className="font-medium">{meta.name} has earned more autonomy.</span>{" "}
              It&apos;s been reliable — raise it to{" "}
              <span className="font-medium">{LEVEL_LABEL[entry.graduation.nextLevel]}</span>?
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="ghost" disabled={busy} onClick={onDismiss}>
              Not now
            </Button>
            <Button size="sm" disabled={busy} onClick={() => onGraduate(entry.graduation!.nextLevel)}>
              Raise to {LEVEL_LABEL[entry.graduation.nextLevel]}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
