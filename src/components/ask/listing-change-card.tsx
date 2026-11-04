"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { presenceChangesApi } from "@/lib/api/presence-changes";
import { cardStatus, type ListingChangeCardData } from "@/lib/presence-change-card";
import { cn } from "@/lib/utils";

/**
 * A listing change Ask Peakhour prepared, with Approve and Discard (PE-09).
 *
 * MARKUP OVER `lib/presence-change-card.ts`. The headline and the before and after are the stored change's, sent by the api; the status is read
 * again here by id so a card shown later is not stale. The assistant can only prepare this card: the press below is the approval.
 */
const KEY = (id: string) => ["presence", "change", id] as const;

function wordsOf(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return "Only an admin of this business can approve a change.";
    return err.message;
  }
  return "That did not work. Please try again.";
}

export function ListingChangeCard({ card }: { card: ListingChangeCardData }) {
  const qc = useQueryClient();
  const [problem, setProblem] = useState<string | null>(null);
  // The stored row's current status. The card's own status is what it was when the assistant prepared it.
  const live = useQuery({
    queryKey: KEY(card.id),
    queryFn: () => presenceChangesApi.get(card.id),
    staleTime: 15_000,
    refetchInterval: (q) => (["approved", "applying", "submitted"].includes(q.state.data?.item.status ?? "") ? 20_000 : false),
  });
  const item = live.data?.item;
  const status = cardStatus(item?.status ?? card.status, {
    held: item?.held?.reason ?? null,
    reason: item?.reason?.message ?? card.blockedReason,
    liveNote: item?.liveCheck?.note ?? null,
  });

  const decide = useMutation({
    mutationFn: (kind: "approve" | "reject") => (kind === "approve" ? presenceChangesApi.approve(card.id) : presenceChangesApi.reject(card.id)),
    onSuccess: (res) => {
      setProblem(null);
      qc.setQueryData(KEY(card.id), res);
    },
    onError: (err) => {
      setProblem(wordsOf(err));
      void qc.invalidateQueries({ queryKey: KEY(card.id) });
    },
  });

  return (
    <div className="w-full max-w-[85%] space-y-2 rounded-xl border bg-card p-3 text-sm" data-testid="listing-change-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {card.placeName} · {card.networkLabel} · {card.fieldLabel}
          </p>
          <p className="font-medium">{card.headline}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs",
            status.tone === "waiting" && "bg-warning/10 text-warning-on-tint",
            status.tone === "progress" && "bg-muted text-foreground",
            status.tone === "done" && "bg-success/10 text-success",
            status.tone === "problem" && "bg-destructive/10 text-destructive",
            status.tone === "closed" && "bg-muted text-muted-foreground",
          )}
        >
          {status.label}
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Now</dt>
          <dd className="whitespace-pre-wrap">{card.before}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">After you approve</dt>
          <dd className="whitespace-pre-wrap">{card.after}</dd>
        </div>
      </dl>

      {card.notes.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
          {card.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      {status.detail && <p className="text-xs text-muted-foreground">{status.detail}</p>}
      {problem && <p className="text-xs text-destructive">{problem}</p>}

      {status.canDecide && (
        <div className="flex gap-2">
          <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate("approve")}>
            {decide.isPending && decide.variables === "approve" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Approve
          </Button>
          <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate("reject")}>
            <X className="size-3.5" />
            Discard
          </Button>
        </div>
      )}
    </div>
  );
}
