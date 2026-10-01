"use client";

import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocale } from "@/hooks/use-locale";
import { agentLabel } from "@/lib/commerce-agents";
import { useCommerceActivity, type ActivityItem } from "@/hooks/use-commerce-activity";
import { failureLine, statusMeta } from "@/lib/commerce-action-status";

/**
 * Command Center "What Peakhour did" digest — the recent ledger feed (api#839).
 * The honest activity trail: which agent did what, when. Self-contained; hides
 * on error (no store) and shows an all-quiet state when empty.
 */


export function ActivityDigest() {
  const { data, isLoading, isError } = useCommerceActivity();

  if (isError) return null;

  const items = data?.items ?? [];

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="flex flex-row items-center gap-2 border-b bg-muted/30 px-4 py-3">
        <Sparkles className="size-4 text-muted-foreground" />
        <CardTitle className="text-base">What Peakhour did</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-4 py-3">
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No activity yet. As you approve proposals, the engine&apos;s work shows up here.
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const { formatRelativeTime } = useLocale();
  // ★One table for the digest and the list (`statusMeta`), so `staged` —
  //  missing here before — and `outcome_unknown` read the same in both.
  const meta = statusMeta(item.status);
  const failure = failureLine(item.status, item.failure);

  return (
    <li className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm">
          <span className="font-medium">{agentLabel(item.agent)}</span>{" "}
          <span className="text-muted-foreground">— {item.title}</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{formatRelativeTime(item.at)}</p>
        {failure && <p className="mt-0.5 text-xs text-warning-on-tint">{failure}</p>}
      </div>
      <Badge
        variant={meta.tone === "warning" ? "outline" : meta.tone}
        className={meta.tone === "warning" ? "shrink-0 border-warning/40 bg-warning/10 text-warning-on-tint" : "shrink-0"}
      >
        {meta.verb}
      </Badge>
    </li>
  );
}
