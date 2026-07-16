"use client";

import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocale } from "@/hooks/use-locale";
import { agentLabel } from "@/lib/commerce-agents";
import { useCommerceActivity, type ActivityItem } from "@/hooks/use-commerce-activity";

/**
 * Command Center "What Peakhour did" digest — the recent ledger feed (api#839).
 * The honest activity trail: which agent did what, when. Self-contained; hides
 * on error (no store) and shows an all-quiet state when empty.
 */

/** Past-tense verb + badge tone per ledger status. */
const STATUS_META: Record<string, { verb: string; tone: "secondary" | "outline" }> = {
  approved: { verb: "approved", tone: "secondary" },
  executed: { verb: "shipped", tone: "secondary" },
  rejected: { verb: "dismissed", tone: "outline" },
  reverted: { verb: "reverted", tone: "outline" },
  proposed: { verb: "proposed", tone: "outline" },
  executing: { verb: "running", tone: "secondary" },
  failed: { verb: "failed", tone: "outline" },
};

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
  const meta = STATUS_META[item.status] ?? { verb: item.status, tone: "outline" as const };

  return (
    <li className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm">
          <span className="font-medium">{agentLabel(item.agent)}</span>{" "}
          <span className="text-muted-foreground">— {item.title}</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{formatRelativeTime(item.at)}</p>
      </div>
      <Badge variant={meta.tone} className="shrink-0">
        {meta.verb}
      </Badge>
    </li>
  );
}
