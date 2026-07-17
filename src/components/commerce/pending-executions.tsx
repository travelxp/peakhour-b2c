"use client";

import { PackageCheck, Zap, FileClock, Undo2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocale } from "@/hooks/use-locale";
import { agentLabel } from "@/lib/commerce-agents";
import { minorToMajor } from "@/lib/money";
import {
  useCommerceActions,
  useApproveAction,
  useExecuteAction,
  useRevertAction,
  type ActionableItem,
} from "@/hooks/use-commerce-actions";

/**
 * Commerce → Autopilot "Ready to ship" surface — the b2c parity with the
 * WordPress plugin's ship loop. Lists the actions a merchant can act on and
 * routes each by ledger status:
 *   proposed  → Approve (makes it shippable)
 *   approved  → Ship it (executes for real, or stages advisory per the
 *               capability matrix — the row shows which BEFORE the click)
 *   executed / staged → Revert
 * Every mutation is optimistic-free (the list refetches on settle); only the row
 * in flight is disabled. Hides entirely when nothing is pending (the Autopilot
 * page already shows the connect / autonomy context).
 */
export function PendingExecutions() {
  const { data, isLoading, isError } = useCommerceActions();
  const approve = useApproveAction();
  const execute = useExecuteAction();
  const revert = useRevertAction();

  if (isError) return null;

  const items = data?.items ?? [];
  const pendingId =
    (approve.isPending && approve.variables) ||
    (execute.isPending && execute.variables) ||
    (revert.isPending && revert.variables) ||
    null;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
        <CardTitle className="text-base">Ready to ship</CardTitle>
        {items.length > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
            {items.length}
          </span>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="px-4 py-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2 h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
            <PackageCheck className="size-7 text-emerald-500" />
            <p className="text-sm font-medium">Nothing waiting to ship</p>
            <p className="text-xs text-muted-foreground">
              Approved actions and agent proposals show up here for you to ship or undo.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <ActionRow
                key={item.id}
                item={item}
                busy={pendingId === item.id}
                onApprove={() => approve.mutate(item.id)}
                onExecute={() => execute.mutate(item.id)}
                onRevert={() => revert.mutate(item.id)}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const STATUS_TONE: Record<string, "secondary" | "outline"> = {
  proposed: "outline",
  approved: "secondary",
  executed: "secondary",
  staged: "outline",
};

function ActionRow({
  item,
  busy,
  onApprove,
  onExecute,
  onRevert,
}: {
  item: ActionableItem;
  busy: boolean;
  onApprove: () => void;
  onExecute: () => void;
  onRevert: () => void;
}) {
  const { formatNumber } = useLocale();
  const p = item.prediction;
  const projected =
    p && typeof p.valueMinor === "number" && p.currency
      ? formatNumber(minorToMajor(p.valueMinor, p.currency), {
          style: "currency",
          currency: p.currency,
          maximumFractionDigits: 0,
        })
      : null;

  // For an approved action, the capability tells us whether shipping applies
  // live or stages advisory — surface it honestly BEFORE the click.
  const willStage = item.status === "approved" && item.capability?.mode !== "execute";

  return (
    <li className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.title}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span>{agentLabel(item.agent)}</span>
            {projected && (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">{projected}</span>
            )}
          </div>
        </div>
        <Badge variant={STATUS_TONE[item.status] ?? "outline"} className="shrink-0 capitalize">
          {item.status}
        </Badge>
      </div>

      {/* Honest capability note on an approved action that will only stage. */}
      {willStage && item.capability && (
        <p className="mt-1.5 flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
          <FileClock aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
          {item.capability.reason}
        </p>
      )}

      <div className="mt-2.5 flex gap-2">
        {item.status === "proposed" && (
          <Button size="sm" disabled={busy} onClick={onApprove}>
            Approve
          </Button>
        )}
        {item.status === "approved" && (
          <Button size="sm" disabled={busy} onClick={onExecute}>
            {willStage ? (
              <>
                <FileClock aria-hidden="true" className="size-3.5" /> Stage
              </>
            ) : (
              <>
                <Zap aria-hidden="true" className="size-3.5" /> Ship it
              </>
            )}
          </Button>
        )}
        {(item.status === "executed" || item.status === "staged") && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={onRevert}>
            <Undo2 aria-hidden="true" className="size-3.5" /> Revert
          </Button>
        )}
      </div>
    </li>
  );
}
