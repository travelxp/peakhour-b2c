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
import {
  audienceLibraryApi,
  AUDIENCE_OBJECTIVES,
  type AudienceObjective,
  type AudienceSet,
} from "@/lib/api/audiences";
import { useAudienceSets } from "@/hooks/use-audience-library";
import { useAudiencePlan, planRefusalCopy } from "@/hooks/use-audience-plan";
import {
  audienceShape,
  channelNotes,
  objectiveLabel,
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
  objective,
  onApplied,
  onBuildByHand,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName: string;
  platform: string;
  /**
   * What THIS campaign is for. `ad_campaigns.objective` and the planner's
   * `objective` are the same four-value enum, so no mapping sits between them —
   * a campaign built to get enquiries is matched against audiences planned to
   * get enquiries.
   *
   * Optional because a legacy row may carry none, and a recommendation section
   * that silently matched everything would be worse than one that says it
   * cannot tell.
   */
  objective?: string;
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

  /**
   * The campaign's objective, but only if the planner would take it.
   *
   * ★`ManagedCampaign.objective` IS `BoostObjective | (string & {})` — a legacy
   * row, or one created by a path that widened its own vocabulary, can carry
   * anything. `PlanBody.objective` is a strict `z.enum`, so casting and posting
   * it produced a 400 and a generic "couldn't build an audience plan" toast for
   * a campaign whose only fault was being old. Narrowing here means an
   * unrecognised objective degrades to "no objective" — the section falls back
   * to "What Peakhour suggests" and the fresh-run button is not offered, which
   * is honest rather than broken.
   */
  const planObjective = AUDIENCE_OBJECTIVES.includes(objective as AudienceObjective)
    ? (objective as AudienceObjective)
    : undefined;

  /**
   * Work out recommendations for THIS campaign, right here.
   *
   * ★THE OBJECTIVE IS NOT ASKED FOR, BECAUSE THE CAMPAIGN ALREADY ANSWERS IT.
   * The Audiences page has to ask — it is planning cold. Here the campaign
   * carries `objective` in the very enum the planner takes, so asking again
   * would be the surface making the customer re-type something it is holding.
   *
   * ★AND IT DOES NOT FIRE ON OPEN. One run is a strong-model call plus up to
   * four rounds of platform typeaheads and reach counts — the better part of a
   * minute, and metered. Opening a dialog is not consent to spend that, and a
   * modal that hangs for forty seconds before showing anything reads as broken.
   * Stored recommendations render instantly; a fresh run is a button.
   */
  const plan = useAudiencePlan({
    onPlanned: (res) => {
      if (res.refusal) {
        const copy = planRefusalCopy(res.refusal.reason, res.refusal.message);
        toast.warning(copy.title, { description: copy.body });
        return;
      }
      toast.success(
        `${res.sets.length} audience${res.sets.length === 1 ? "" : "s"} worked out for this campaign.`,
        { description: "Nothing is running — pick one and it still won't start spending." },
      );
    },
  });
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
   * ★THREE GROUPS, AND THE MIDDLE ONE EXISTS SO NOTHING DISAPPEARS.
   *
   * "Recommended for this campaign" is ours AND planned for this campaign's
   * objective — the only group that can honestly carry that heading, because an
   * audience worked out to get reach is a different suggestion from one worked
   * out to get enquiries and presenting the first as a recommendation for the
   * second is the collapse this engine exists not to make.
   *
   * "Other suggestions" catches everything else we proposed. Dropping those
   * rows would be tidier and would quietly hide audiences a customer paid a
   * model call for.
   *
   * "Saved" is what the customer chose to keep — one they built by hand, or one
   * read off a campaign they actually ran. Neither has an objective, because
   * nobody planned them.
   *
   * The api takes ONE `source` value and no objective filter, so this partitions
   * the page rather than issuing three queries. Honest limit: past `PAGE` rows
   * the groups describe this page, not the library — which is what the count
   * line above says, and why the "we have never suggested any" prompt below is
   * gated on having seen everything.
   */
  const ours = rows.filter((r) => originIsOurs(r.source));
  const recommended = planObjective ? ours.filter((r) => r.objective === planObjective) : [];
  const otherSuggestions = ours.filter((r) => !recommended.includes(r));
  const theirs = rows.filter((r) => !originIsOurs(r.source));
  /**
   * ★"NOTHING HAS BEEN WORKED OUT FOR THIS CAMPAIGN" IS ONLY SAYABLE WHEN THIS
   * PAGE IS THE WHOLE LIBRARY. Past `PAGE` rows an empty top section might just
   * mean the customer's own audiences filled the page, and offering to spend a
   * model call on that basis would be a claim we cannot source — the same
   * accepted-then-ignored-filter failure one layer up.
   */
  //
  // ★AND `ours` HAS TO BE EMPTY TOO WHEN THERE IS NO OBJECTIVE TO MATCH ON. A
  // legacy campaign carrying no objective makes `recommended` empty by
  // construction — so this offered "we haven't worked out any audiences for
  // this business yet", plus a button that spends a model call, directly above
  // an "Other suggestions" list of those very audiences.
  const canOfferPlan =
    recommended.length === 0 &&
    (planObjective ? true : ours.length === 0) &&
    !search &&
    total <= PAGE;

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
          ) : rows.length === 0 && search ? (
            <p className="text-sm text-muted-foreground">
              Nothing in your library matches that.
            </p>
          ) : (
            <>
              {/* ★PEAKHOUR'S RECOMMENDATIONS FOR *THIS* CAMPAIGN LEAD. This is
                  the whole reordering: the engine's answer to "who should see
                  this?" is the default, and the customer's own filing is the
                  alternative to it rather than the other way round. */}
              <Section
                title={ planObjective
                    ? `Recommended for ${objectiveLabel(planObjective)}`
                    : "What Peakhour suggests"
                }
                icon={Sparkles}
                action={
                  // Only offered once we HAVE some — a "get fresh ones" button
                  // above an empty section is the same click as the panel
                  // below it, twice.
                  recommended.length > 0 && planObjective ? (
                    <button
                      type="button"
                      disabled={plan.isPending}
                      onClick={() => plan.mutate({ objective: planObjective, platform })}
                      className="text-xs font-medium text-primary hover:underline disabled:opacity-60"
                    >
                      {plan.isPending ? "Working…" : "Work out fresh ones"}
                    </button>
                  ) : null
                }
                empty={
                  canOfferPlan ? (
                    <div className="space-y-2 rounded-md border border-dashed p-3">
                      <p className="text-xs text-muted-foreground">
                        {planObjective
                          ? `We haven't worked out who to target for ${objectiveLabel(planObjective)} yet. We can do it now from what we already know about your business — no past campaigns needed.`
                          : "We haven't worked out any audiences for this business yet. We can do it from what we already know about you — no past campaigns needed."}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={plan.isPending}
                        onClick={() =>
                          planObjective
                            ? plan.mutate({
                                objective: planObjective,
                                platform,
                              })
                            : setDiscoverOpen(true)
                        }
                      >
                        <Sparkles className="mr-1.5 size-3.5" aria-hidden="true" />
                        {/* ★NAMED, NOT A SPINNER. This is a strong-model call
                            plus up to four rounds of platform lookups — the
                            better part of a minute — and a control that says
                            nothing for that long reads as broken. */}
                        {plan.isPending ? "Working out who to target…" : "Get recommendations"}
                      </Button>
                    </div>
                  ) : null
                }
              >
                {recommended.map((set) => (
                  <AudienceOption
                    key={set.id}
                    set={set}
                    platform={platform}
                    picked={chosen?.id === set.id}
                    onPick={() => setChosen(set)}
                  />
                ))}
              </Section>

              {/* ★NOT DROPPED, BECAUSE THEY ARE STILL AUDIENCES WE PROPOSED.
                  An audience planned for a different objective may not wear the
                  recommendation heading — but hiding it would quietly bin work
                  a customer already paid a model call for. */}
              <Section title="Other suggestions" icon={Sparkles} empty={null}>
                {otherSuggestions.map((set) => (
                  <AudienceOption
                    key={set.id}
                    set={set}
                    platform={platform}
                    picked={chosen?.id === set.id}
                    onPick={() => setChosen(set)}
                  />
                ))}
              </Section>

              {/* ★ONLY WHAT THE CUSTOMER CHOSE TO KEEP. One they built by hand,
                  or one read off a campaign they actually ran — the badge on
                  each row says which. Nothing we proposed appears here. */}
              <Section title="Saved" icon={PencilLine} empty={null}>
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
  action,
  children,
}: {
  title: string;
  icon: typeof Sparkles;
  empty: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode[];
}) {
  if (children.length === 0 && empty === null) return null;
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className="size-3.5" aria-hidden="true" />
          {title}
        </h3>
        {action}
      </div>
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
