"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Library } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { audienceLibraryApi, type AudienceSet } from "@/lib/api/audiences";
import { useAudienceSets } from "@/hooks/use-audience-library";
import {
  audienceShape,
  channelNotes,
  originLabel,
  platformLabel,
  reachReading,
} from "@/lib/audience-library-rules";

/**
 * Put an audience you already have on this campaign (G4).
 *
 * ★THE LIBRARY'S WHOLE POINT, AND UNTIL NOW IT HAD NO WAY IN. `biz_audience_sets`
 * exists so an audience built once can be reused on a campaign created months
 * later — but every boosted campaign got whatever the engine proposed at the
 * moment it was created, and the rows nobody could reach might as well not have
 * been there.
 *
 * ★IT SPENDS NOTHING. A draft stays a draft; an active campaign re-enters the
 * platform's review with a new audience, exactly as the manual targeting editor
 * already does.
 *
 * ★AND IT ASKS FOR AUDIENCES THAT WORK ON THIS CAMPAIGN'S CHANNEL, which is
 * "carries a shape for it", not "was born on it" — an idea planned on LinkedIn
 * and since resolved for X belongs in both lists. That is the channel-neutral
 * library's entire claim, and this is the first place a customer feels it.
 */
export function UseSavedAudienceDialog({
  open,
  onOpenChange,
  campaignId,
  campaignName,
  platform,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName: string;
  platform: string;
  onApplied?: () => void;
}) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [chosen, setChosen] = useState<AudienceSet | null>(null);

  // ★DISCARDED AUDIENCES ARE NOT OFFERED. A discard is a decision the customer
  // made, and re-offering it as a suggestion is the surface arguing with them.
  // The api would refuse it anyway (409 SET_DISCARDED), so offering it would be
  // a dead control as well as a rude one.
  const sets = useAudienceSets({
    platform,
    status: "proposed",
    ...(q.trim() ? { q: q.trim() } : {}),
    limit: 20,
  });

  const apply = useMutation({
    mutationFn: (setId: string) => audienceLibraryApi.applySet(setId, campaignId),
    onSuccess: (res) => {
      toast.success("That audience is on the campaign now.", {
        description:
          res.supersededSetIds.length > 0
            ? "The one it replaced is marked as superseded — nothing was deleted."
            : "Nothing has started spending — activate the campaign when you're ready.",
      });
      // The campaign's targeting and provenance both moved, and so did the
      // library's own bookkeeping (this set is applied; another may have been
      // superseded).
      void queryClient.invalidateQueries({ queryKey: ["linkedin-managed-campaigns"] });
      void queryClient.invalidateQueries({ queryKey: ["audience-sets"] });
      void queryClient.invalidateQueries({ queryKey: ["audience-set"] });
      onOpenChange(false);
      setChosen(null);
      onApplied?.();
    },
    onError: (err) => {
      const code = err instanceof ApiError ? err.code : undefined;
      const message = err instanceof ApiError ? err.message : "";
      // ★THE API'S REFUSALS ARE ANSWERS AND ARE SHOWN AS THEY ARE WRITTEN. Every
      // one of these is a sentence about THIS audience on THIS channel —
      // "we won't spend against a version we can't confirm", "X can't express
      // anything that makes this audience specific" — and replacing them with
      // "something went wrong" would throw away the only useful part.
      if (
        code &&
        [
          "SET_STALE",
          "SET_NOT_SERVABLE",
          "SET_DISCARDED",
          "PLATFORM_MISMATCH",
          "FACET_NOT_APPLIABLE",
          "NO_HYPOTHESIS",
          "INVALID_TRANSITION",
        ].includes(code)
      ) {
        toast.error(message || "We couldn't put that audience on this campaign.");
        return;
      }
      if (code === "NEEDS_REAUTH" || code === "NOT_CONNECTED") {
        toast.error(`${platformLabel(platform)} Ads needs reconnecting before we can do that.`);
        return;
      }
      toast.error("We couldn't put that audience on this campaign. Nothing was changed.");
    },
  });

  const rows = sets.data?.sets ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && apply.isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="size-4" aria-hidden="true" />
            Use a saved audience
          </DialogTitle>
          <DialogDescription>
            Put one of your existing audiences on &ldquo;{campaignName}&rdquo;. This replaces
            the campaign&apos;s whole audience and starts no spending — activate it when
            you&apos;re ready.
          </DialogDescription>
        </DialogHeader>

        <Input
          value={q}
          onChange={(e) => setQ(e.target.value.slice(0, 80))}
          maxLength={80}
          placeholder="Search your audiences…"
          aria-label="Search your audiences"
        />

        <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
          {sets.isPending ? (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          ) : sets.isError ? (
            <p className="text-sm text-muted-foreground">
              We couldn&apos;t load your audiences just now.
            </p>
          ) : rows.length === 0 ? (
            // ★TWO EMPTIES AGAIN, AND THEY ARE NOT THE SAME SENTENCE. "Nothing
            // matches that search" is not "you have no audiences that work
            // here", and the second is not "you have no audiences".
            <p className="text-sm text-muted-foreground">
              {q.trim()
                ? "Nothing in your library matches that."
                : `None of your saved audiences has been worked out for ${platformLabel(platform)} yet — open one from Audiences and check this channel first.`}
            </p>
          ) : (
            rows.map((set) => {
              const channel = set.channels.find((c) => c.platform === platform);
              const shape = audienceShape(set);
              const picked = chosen?.id === set.id;
              return (
                <button
                  key={set.id}
                  type="button"
                  onClick={() => setChosen(set)}
                  className={`w-full rounded-md border p-3 text-left transition-colors hover:bg-muted/50 ${
                    picked ? "border-primary bg-muted/40" : ""
                  }`}
                  aria-pressed={picked}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{set.name}</span>
                    <span className="flex items-center gap-1.5">
                      {picked && <Check className="size-3.5 text-primary" aria-hidden="true" />}
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {originLabel(set.source)}
                      </Badge>
                    </span>
                  </div>
                  {shape.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {shape.map((r) => `${r.label}: ${r.values.join(", ")}`).join(" · ")}
                    </p>
                  )}
                  {/* The reach on THIS channel, and what it could not express —
                      both of which are what the customer is choosing between. */}
                  {channel && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[reachReading(channel).text, ...channelNotes(channel)].join(" · ")}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={apply.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!chosen || apply.isPending}
            onClick={() => chosen && apply.mutate(chosen.id)}
          >
            {apply.isPending ? "Applying…" : "Use this audience"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
