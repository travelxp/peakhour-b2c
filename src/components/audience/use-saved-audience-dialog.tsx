"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, PencilLine, Sparkles, Target } from "lucide-react";
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
  originIsOurs,
  originLabel,
  platformLabel,
  reachReading,
} from "@/lib/audience-library-rules";
import { DiscoverAudiencesDialog } from "./discover-audiences-dialog";

/**
 * Set this campaign's audience (G4).
 *
 * ★WHAT PEAKHOUR SUGGESTS COMES FIRST, AND THAT ORDER IS THE PRODUCT. This
 * surface used to be the SECOND of two buttons — "Set audience" opened a blank
 * facet picker and "Saved" opened this list — so the default path through a
 * campaign was a customer hand-picking LinkedIn URNs while an engine that had
 * already worked out who to target sat one button to the right. The two are now
 * one dialog in the order the engine actually works: our recommendations, then
 * the audiences they own, then the hand-built escape hatch.
 *
 * ★AND AN EMPTY RECOMMENDATIONS LIST IS AN ACTION, NOT A BLANK. A business
 * nobody has run a planning session for has no suggestions to show, and the fix
 * — ask for some — is one call away and belongs here rather than on another
 * page.
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
  onBuildByHand,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName: string;
  platform: string;
  onApplied?: () => void;
  /** Hand off to the facet editor. Kept as a callback rather than rendering the
   *  editor here: the two dialogs are owned by the campaign row, which is the
   *  only thing that knows the campaign's full shape, and nesting one modal
   *  inside another is how a Cancel closes the wrong one. */
  onBuildByHand?: () => void;
}) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [chosen, setChosen] = useState<AudienceSet | null>(null);
  const [discoverOpen, setDiscoverOpen] = useState(false);
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
          // The set really did move to `applied` — the claim is not released on
          // this path — so a detail page open elsewhere is now wrong too.
          void queryClient.invalidateQueries({ queryKey: ["audience-set"] });
          onOpenChange(false);
          setChosen(null);
          // Same as the success path: this IS a success on the platform, and a
          // caller advancing a flow on it would otherwise stall silently.
          onApplied?.();
          toast.warning(
            message ||
              `The audience was applied on ${platformLabel(platform)} but we couldn't save it here — apply again to refresh.`,
            // ★AND IT DOES NOT AUTO-DISMISS. This is the money-critical
            // message on this surface — the campaign's targeting has moved and
            // our copy has not — and a four-second toast is how a customer
            // activates against an audience they never saw.
            { duration: Number.POSITIVE_INFINITY },
          );
          return;
        case "ad_account_not_authorized":
          // Not a reconnect, and the shared helper is the one place that says
          // so properly — this is the 403 that is live on the boost path.
          // ★THE CHANNEL, NAMED. The helper defaults its third argument to
          // "LinkedIn", and this is the one component in the codebase that
          // takes `platform` as a prop precisely so it can be channel-neutral
          // — the same storage-key-in-a-headline defect api#1026 fixed on the
          // server, reintroduced one layer up by omitting an argument.
          toastAdAccountNotAuthorized(
            err,
            "Putting an audience on this campaign",
            platformLabel(platform),
          );
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
  /**
   * ★A SELECTION THE CUSTOMER CAN NO LONGER SEE MAY NOT BE APPLIED. Pick an
   * audience, then type a search that excludes it: the row disappears, nothing
   * on screen is selected, and "Use this audience" stayed enabled — applying
   * the invisible one. Derived rather than cleared in an effect, so it cannot
   * be out of step with the rows for a render.
   */
  const selected = chosen && rows.some((r) => r.id === chosen.id) ? chosen : null;

  /**
   * ★OURS FIRST, THEIRS SECOND, AND THE HEADINGS SAY WHICH IS WHICH. The api
   * takes ONE `source` value, so two server-side queries would be needed to
   * fetch the two groups separately — for a picker that already caps at twenty
   * and searches to narrow, partitioning the page is the same answer for one
   * request instead of two.
   */
  const suggested = rows.filter((r) => originIsOurs(r.source));
  const theirs = rows.filter((r) => !originIsOurs(r.source));
  /**
   * ★"WE HAVE NEVER SUGGESTED ANY" IS ONLY SAYABLE WHEN THIS PAGE IS THE WHOLE
   * LIBRARY. Past twenty rows an empty top section might just mean the
   * customer's own audiences filled the page, and offering to go and generate
   * more on that basis would be a claim we cannot source — the same
   * accepted-then-ignored-filter failure one layer up.
   */
  const noSuggestionsAnywhere = suggested.length === 0 && !search && total <= PAGE;

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
            <Target className="size-4" aria-hidden="true" />
            Set the audience
          </DialogTitle>
          <DialogDescription>
            Who should see &ldquo;{campaignName}&rdquo;? Pick one of ours or one of yours —
            it replaces the campaign&apos;s whole audience and starts no spending, so you
            activate when you&apos;re ready.
          </DialogDescription>
        </DialogHeader>

        <Input
          value={q}
          onChange={(e) => setQ(e.target.value.slice(0, SEARCH_MAX))}
          maxLength={SEARCH_MAX}
          placeholder="Search audiences…"
          aria-label="Search audiences"
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
            <>
              {/* ★PEAKHOUR'S OWN SUGGESTIONS LEAD. This is the whole reordering:
                  the engine's answer to "who should see this?" is the default,
                  and the customer's own filing is the alternative to it rather
                  than the other way round. */}
              <Section
                title="What Peakhour suggests"
                icon={Sparkles}
                empty={
                  noSuggestionsAnywhere ? (
                    <div className="space-y-2 rounded-md border border-dashed p-3">
                      <p className="text-xs text-muted-foreground">
                        We haven&apos;t worked out any audiences for this business yet — we
                        can do it from what we already know about you, with no past
                        campaigns needed.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setDiscoverOpen(true)}
                      >
                        <Sparkles className="mr-1.5 size-3.5" aria-hidden="true" />
                        Find audiences
                      </Button>
                    </div>
                  ) : null
                }
              >
                {suggested.map((set) => (
                  <AudienceOption
                    key={set.id}
                    set={set}
                    platform={platform}
                    picked={chosen?.id === set.id}
                    onPick={() => setChosen(set)}
                  />
                ))}
              </Section>

              <Section title="Yours" icon={PencilLine} empty={null}>
                {theirs.map((set) => (
                  <AudienceOption
                    key={set.id}
                    set={set}
                    platform={platform}
                    picked={chosen?.id === set.id}
                    onPick={() => setChosen(set)}
                  />
                ))}
              </Section>
            </>
          )}
        </div>

        {discoverOpen && (
          <DiscoverAudiencesDialog
            open={discoverOpen}
            onOpenChange={setDiscoverOpen}
            platform={platform}
          />
        )}

        <DialogFooter className="sm:justify-between">
          {/* ★THE HAND-BUILT PATH STAYS, AND IT STAYS SUBORDINATE. It is the
              right answer for a customer who knows exactly which twelve job
              titles they want, and the wrong DEFAULT for everyone else — which
              is what it was when it had the primary button and its own tab
              stop ahead of every suggestion we had already made. */}
          {onBuildByHand ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={apply.isPending}
              onClick={() => {
                onOpenChange(false);
                onBuildByHand();
              }}
            >
              <PencilLine className="mr-1.5 size-3.5" aria-hidden="true" />
              Build one by hand
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
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
              disabled={!selected || apply.isPending}
              onClick={() => selected && apply.mutate(selected.id)}
            >
              {apply.isPending ? "Applying…" : "Use this audience"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A titled group of options, or the caller's own sentence when it has none.
 *
 * ★AN EMPTY GROUP DISAPPEARS RATHER THAN RENDERING AN EMPTY HEADING, unless the
 * caller supplied something to say in its place — a heading over nothing reads
 * as a list that failed to load.
 */
function Section({
  title,
  icon: Icon,
  empty,
  children,
}: {
  title: string;
  icon: typeof Sparkles;
  empty: React.ReactNode;
  children: React.ReactNode[];
}) {
  if (children.length === 0 && empty === null) return null;
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {title}
      </h3>
      {children.length > 0 ? children : empty}
    </section>
  );
}

/** One audience, as something to choose. */
function AudienceOption({
  set,
  platform,
  picked,
  onPick,
}: {
  set: AudienceSet;
  platform: string;
  picked: boolean;
  onPick: () => void;
}) {
  const channel = set.channels.find((c) => c.platform === platform);
  const shape = audienceShape(set);
  return (
    <button
      type="button"
      onClick={onPick}
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
      {/* ★THE ENGINE'S SENTENCE ABOUT WHO THESE PEOPLE ARE, WHERE THE CHOICE IS
          ACTUALLY MADE. `explanation` has been written on every planned set
          since B2 and returned by `GET /sets` all along; this picker showed a
          row of raw attribute values instead, which is the targeting rather
          than the idea. */}
      {set.explanation && (
        <p className="mt-1 text-xs text-muted-foreground">{set.explanation}</p>
      )}
      {shape.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          {shape.map((r) => `${r.label}: ${r.values.join(", ")}`).join(" · ")}
        </p>
      )}
      {/* The reach on THIS channel, and what it could not express — both of
          which are what the customer is choosing between. */}
      {channel && (
        <p className="mt-1 text-xs text-muted-foreground">
          {[reachReading(channel).text, ...channelNotes(channel)].join(" · ")}
        </p>
      )}
    </button>
  );
}
