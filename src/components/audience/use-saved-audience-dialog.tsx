"use client";

import { useEffect, useState } from "react";
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
import {
  toastAdAccountForbidden,
  toastAdAccountNotAuthorized,
  toastUnhandledApiError,
} from "@/lib/toast-errors";
import { classifyApplyError } from "@/lib/audience-apply-errors";
import { SEARCH_MAX } from "@/app/(site)/dashboard/growth/audiences/filters";
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

/** How many to show. Searching is the way through a bigger library — a picker
 *  with pagination is a page. */
const PAGE = 20;

/** Debounce a value. Same shape as the library page's and the targeting
 *  dialog's; kept local rather than shared until a fourth caller wants it. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

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
  // ★DEBOUNCED, LIKE THE LIBRARY PAGE. `GET /sets` runs a regex `find` AND a
  // `countDocuments` per request, over a query the api itself documents as a
  // blocking-sort collection scan — so an undebounced picker double-scans a
  // customer's library on every keystroke.
  const search = useDebounced(q.trim(), 350);

  // ★NOT-DISCARDED, NOT "PROPOSED". A discard is a decision the customer made,
  // and re-offering it is the surface arguing with them (the api 409s it
  // anyway) — but a first cut asked for `proposed` because that was the only
  // filter the api had, and apply sets `applied`. So every audience they had
  // ever used disappeared from this list: the SECOND campaign could not reuse
  // the audience, which is the whole of what a library is for. `excludeStatus`
  // exists for this.
  const sets = useAudienceSets({
    platform,
    excludeStatus: "discarded",
    ...(search ? { q: search } : {}),
    limit: PAGE,
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
      const message = err instanceof ApiError ? err.message : "";
      switch (classifyApplyError(err instanceof ApiError ? err.code : undefined)) {
        case "persisted_on_platform":
          // ★A QUALIFIED SUCCESS, NOT A FAILURE. The platform HAS the new
          // audience; only our mirror did not save. A first cut said "nothing
          // was changed" — about a campaign whose targeting had already moved,
          // to a customer whose next act is to activate it.
          void queryClient.invalidateQueries({ queryKey: ["linkedin-managed-campaigns"] });
          void queryClient.invalidateQueries({ queryKey: ["audience-sets"] });
          onOpenChange(false);
          setChosen(null);
          toast.warning(
            message ||
              `The audience was applied on ${platformLabel(platform)} but we couldn't save it here — apply again to refresh.`,
          );
          return;
        case "ad_account_not_authorized":
          // Not a reconnect, and the shared helper is the one place that says
          // so properly — this is the 403 that is live on the boost path.
          toastAdAccountNotAuthorized(err, "Putting an audience on this campaign");
          return;
        case "ad_account_forbidden":
          toastAdAccountForbidden(err, `${platformLabel(platform)} refused this ad account.`);
          return;
        case "audience":
          // ★THE API'S SENTENCE, AS WRITTEN. Each is about THIS audience on
          // THIS channel — "we won't spend against a version we can't
          // confirm", "add a location to it first" — and it is the only useful
          // part of the answer.
          toast.error(message || "We couldn't put that audience on this campaign.");
          return;
        default:
          // ★AND EVERYTHING ELSE TO THE SHARED HANDLER, which owns the
          // retry-versus-permanent split, the support reference, and the
          // NOT_FOUND deploy-order hazard. A bare `toast.error` here is the
          // pattern `toast-errors.ts` was written to end.
          toastUnhandledApiError(err, "put that audience on the campaign", platformLabel(platform));
      }
    },
  });

  const rows = sets.data?.sets ?? [];
  const total = sets.data?.total ?? 0;

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
          onChange={(e) => setQ(e.target.value.slice(0, SEARCH_MAX))}
          maxLength={SEARCH_MAX}
          placeholder="Search your audiences…"
          aria-label="Search your audiences"
        />

        {total > PAGE && (
          // ★SAID, BECAUSE A LIST THAT STOPS AT TWENTY WITH NOTHING SAYING SO
          // IS A LIBRARY THAT LOOKS SMALLER THAN IT IS. Searching is the way
          // through; paginating a picker is not worth the surface.
          <p className="text-xs text-muted-foreground">
            Showing {rows.length} of {total} — search to narrow it down.
          </p>
        )}
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
              {search
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
