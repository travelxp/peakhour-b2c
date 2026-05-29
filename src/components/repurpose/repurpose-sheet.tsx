"use client";

import { useEffect, useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CalendarClock,
  ArrowLeft,
  FileEdit,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  recommendPlatforms,
  repurpose,
  getChannelDisplay,
  BAND_STYLES,
  type RepurposeSource,
  type PlatformRecommendation,
  type RepurposeResponse,
  type RepurposedAdaptation,
} from "@/lib/api/repurpose";
import { SchedulerComposer } from "@/components/scheduler/scheduler-composer";
import type {
  CommitPlanRequest,
  ScheduleSourceType,
} from "@/lib/scheduler/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Caller-provided source. When the sheet opens we fire
   *  /recommend-platforms with this source; when the user confirms
   *  the platform picker, /repurpose runs with the same source.
   *
   *  IMPORTANT: must be referentially stable while the sheet is
   *  open. The reset effect depends on `[open, source]`, so a parent
   *  that passes a fresh object literal each render will refire the
   *  recommend on every parent re-render (re-fetch storm). Memoise
   *  with useMemo or hoist to a stable ref. */
  source: RepurposeSource | null;
}

/** Local state machine for the post-generation "what next?" step.
 *  `choose` is the default after variants land; the user picks
 *  Schedule (mounts <SchedulerComposer/>) or Save as draft (the
 *  variants are already persisted in soc_social_posts so this is
 *  effectively a toast + close). */
type DoneIntent = "choose" | "schedule";

/** Maps the repurposer's source-discriminant union to the scheduler's
 *  ScheduleSourceType. `published_post` → `social_post` rename matches
 *  the cnt_drafts vs soc_social_posts collection naming. */
function toScheduleSourceType(s: RepurposeSource): ScheduleSourceType {
  switch (s.type) {
    case "draft":
      return "draft";
    case "idea":
      return "idea";
    case "published_post":
      return "social_post";
    case "ad_hoc":
      return "ad_hoc";
  }
}

/** Maps the repurposer source to the scheduler's optional sourceRef
 *  (Mongo hex id where applicable; absent for ad_hoc inline content). */
function toScheduleSourceRef(s: RepurposeSource): string | undefined {
  switch (s.type) {
    case "draft":
      return s.draftId;
    case "idea":
      return s.ideaId;
    case "published_post":
      return s.socialPostId;
    case "ad_hoc":
      return undefined;
  }
}

/** Builds the SchedulerComposer's `channels` prop from a successful
 *  repurpose response. The engine returns up to N adaptations per
 *  platform (X returns 2: "post" + "thread"); the scheduler wants
 *  ONE row per channel. We take the FIRST adaptation per platform
 *  as the canonical payload. X-thread support lives in PR #4 (X
 *  composer rewrite) which will surface a thread builder UI that
 *  packs metadata.tweets into payload.threadParts; foundation-PR
 *  scheduler launch ships post-only.
 *
 *  Stub channels (Facebook / Instagram / Threads) never make it into
 *  response.adaptations — the repurposer filters them before persist
 *  — so the scheduler list naturally excludes them. */
function adaptationsToChannels(
  response: RepurposeResponse,
): CommitPlanRequest["channels"] {
  const seen = new Map<string, RepurposedAdaptation>();
  for (const a of response.adaptations) {
    if (!seen.has(a.platform)) seen.set(a.platform, a);
  }
  return Array.from(seen.values()).map((a) => ({
    channel: a.platform,
    payload: {
      text: a.content,
      ...(a.hashtags && a.hashtags.length > 0 ? { hashtags: a.hashtags } : {}),
    },
  }));
}

/** Stable fingerprint for the scheduler's required `sourceTextHash`.
 *  Prefer the soc_social_posts id when the repurposer persisted at
 *  least one variant — same generation always returns the same id
 *  thanks to the idempotency layer. Fallback: synthesise from source
 *  title + ALL adaptation contents joined in a deterministic
 *  (sorted-by-platform) order — guarantees the same hash across
 *  sessions even if the engine returns adaptations in different
 *  order. Hash doesn't need to be cryptographically strong; the
 *  server uses it for plan dedup, not security. */
function sourceTextHashFor(response: RepurposeResponse): string {
  if (response.socialPostId) return response.socialPostId;
  // Sort by platform so a parallel-fanout engine that yields
  // adaptations out of order still produces the same hash.
  const sortedContents = [...response.adaptations]
    .sort((a, b) => a.platform.localeCompare(b.platform))
    .map((a) => `${a.platform}:${a.content}`)
    .join("|");
  const fallback = (response.sourceTitle ?? "") + "||" + sortedContents;
  // djb2a (XOR variant) — good enough for plan dedup, avoids a
  // crypto dependency for this fallback path.
  let h = 5381;
  for (let i = 0; i < fallback.length; i++) h = (h * 33) ^ fallback.charCodeAt(i);
  return `rp:${(h >>> 0).toString(36)}`;
}

/**
 * Shared "Repurpose to platforms" sheet used from every entry point
 * (SuggestedDraftCard, Beehiiv row action — paste-and-repurpose
 * composer ships later when /repurpose accepts ad_hoc sources).
 * Owns the recommend → confirm → generate flow end-to-end:
 *
 *   1. Open → fires POST /v1/content/recommend-platforms with the
 *      source. Renders skeletons while the recommender scores.
 *   2. Recommendations land → renders one row per scored channel
 *      with band badge + rationale + checkbox. Green pre-checked,
 *      amber pre-checked, grey unchecked (the user can override).
 *      Hard-blocked greys are checkbox-disabled with the
 *      hardBlocks reasons rendered inline next to the rationale.
 *   3. User clicks Generate → fires POST /v1/content/repurpose with
 *      platforms[] + platformFitId. Renders per-channel progress.
 *   4. Variants land → renders preview cards with VariantPreview
 *      (expand/collapse). Stub channels (Facebook / Instagram /
 *      Threads) are scored by the recommender but the engine
 *      filters them out before the soc_social_posts persist — so
 *      they don't appear in the Done view; users see them only in
 *      the recommend list with greyed-out / hard-block reasoning.
 *
 * Lifecycle note: the parent mounts <RepurposeSheet/> unconditionally
 * (open is just a prop), so the component itself persists across
 * close/open cycles — only radix's <SheetContent/> portal unmounts.
 * The reset effect on [open, source] calls mutation.reset() before
 * re-firing the recommend, so no stale data leaks into the next
 * session.
 */
export function RepurposeSheet({ open, onOpenChange, source }: Props) {
  const recommendMutation = useMutation({
    mutationFn: (s: RepurposeSource) => recommendPlatforms(s),
    onError: (err: Error) => {
      toast.error(err.message || "Failed to score platforms");
    },
  });

  const repurposeMutation = useMutation({
    mutationFn: (args: { source: RepurposeSource; platforms: string[]; platformFitId: string }) =>
      repurpose(args),
    onSuccess: (data: RepurposeResponse) => {
      const real = data.adaptations.length;
      if (real === 0) {
        toast.info(
          "No variants generated — every selected channel is either coming soon or failed.",
        );
      } else if (data.idempotent) {
        toast.success(`Showing your previous repurpose (${real} variant${real === 1 ? "" : "s"})`);
      } else {
        toast.success(`Generated ${real} variant${real === 1 ? "" : "s"}`);
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to generate variants");
    },
  });

  // User's current platform selection, keyed by channel. Initialised
  // from the recommendations when they land (green + amber pre-
  // checked, grey unchecked unless hard-blocked).
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // Post-variant intent — "choose" surfaces the Schedule / Save-as-
  // draft CTA bar; "schedule" mounts <SchedulerComposer/> inline.
  // Resets each time the sheet reopens with a new source.
  const [doneIntent, setDoneIntent] = useState<DoneIntent>("choose");

  const queryClient = useQueryClient();

  // Reset everything when the sheet opens with a new source.
  useEffect(() => {
    if (!open || !source) return;
    setSelected({});
    setDoneIntent("choose");
    recommendMutation.reset();
    repurposeMutation.reset();
    recommendMutation.mutate(source);
    // mutations themselves are stable refs; we only want to re-fire
    // when the open transition happens with a non-null source.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source]);

  const recommendData = recommendMutation.data;
  // Memoised so the useEffect dep array sees a stable identity —
  // without this, the seeding effect would re-fire on every render
  // (data ref is stable, but `?? []` produces a fresh array each
  // time). Depend on the inner `recommendations` array rather than
  // the whole `recommendData` object so the memo cache hit is tighter
  // (avoids unnecessary seeding re-fires when other fields on
  // recommendData would have updated).
  const recommendations = useMemo(
    () => recommendData?.recommendations ?? [],
    [recommendData?.recommendations],
  );
  const platformFitId = recommendData?.platformFitId ?? null;

  // Seed selection state once recommendations are available. Only
  // runs on the first mount where data is present — subsequent user
  // toggles take over.
  useEffect(() => {
    if (recommendations.length === 0) return;
    setSelected((prev) => {
      // Don't overwrite if user already toggled something.
      if (Object.keys(prev).length > 0) return prev;
      const seeded: Record<string, boolean> = {};
      for (const r of recommendations) {
        const isHardBlocked = (r.hardBlocks?.length ?? 0) > 0;
        if (isHardBlocked) {
          seeded[r.channel] = false; // disabled in UI
        } else {
          // green + amber pre-checked, grey unchecked (user opt-in)
          seeded[r.channel] = r.band === "green" || r.band === "amber";
        }
      }
      return seeded;
    });
  }, [recommendations]);

  const finalPlatforms = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected],
  );

  const stage:
    | "loading"
    | "recommend"
    | "generating"
    | "done"
    | "empty"
    | "error" =
    // Defensive: open with no source = a parent bug; render loading
    // (skeletons) rather than an empty checkbox list while the parent
    // sorts itself out.
    source === null
      ? "loading"
      : repurposeMutation.isPending
        ? "generating"
        : repurposeMutation.isSuccess
          ? "done"
          : recommendMutation.isError
            ? "error"
            : // `isIdle` = about to call mutate via the reset effect;
              // treat as loading instead of letting the fallback
              // "recommend" branch render an empty list for one frame.
              recommendMutation.isPending || recommendMutation.isIdle
              ? "loading"
              : recommendations.length === 0 && recommendMutation.isSuccess
                ? "empty"
                : "recommend";

  function handleConfirm() {
    if (!source || !platformFitId || finalPlatforms.length === 0) return;
    repurposeMutation.mutate({ source, platforms: finalPlatforms, platformFitId });
  }

  function handleClose() {
    onOpenChange(false);
  }

  function handleSaveAsDraft() {
    // The variants are ALREADY persisted to soc_social_posts by the
    // /v1/content/repurpose call — "Save as draft" is the no-op
    // confirmation that nothing further is auto-scheduled. The
    // soc_social_posts surface on each channel's dashboard tab
    // (e.g. /dashboard/content/linkedin → SuggestedDraftsPanel)
    // shows the draft awaiting publish.
    toast.success("Saved as drafts.", {
      description:
        "Your variants are saved in Peakhour. Open each channel's dashboard tab to publish or schedule them anytime.",
    });
    onOpenChange(false);
  }

  // No-arg handler — SchedulerComposer's onScheduled passes a
  // CommitPlanResponse we don't need today (the composer's own
  // success toast already surfaces the channel count; we'd just
  // double-toast). TS callback variance allows the narrower signature.
  function handleScheduled() {
    // SchedulerComposer fires its own "Scheduled across N channels."
    // toast inside submit() — we don't double-toast here. We DO
    // invalidate the calendar's React Query key so a parallel
    // /dashboard/calendar tab refreshes without manual reload.
    // 'scheduler:plans' is not consumed today (no plans-list query
    // anywhere); only invalidate the keys with live subscribers.
    queryClient.invalidateQueries({ queryKey: ["scheduler:items"] });
    onOpenChange(false);
    // NOTE: doneIntent is NOT reset here — relies on the [open, source]
    // reset effect (line above) firing when the sheet reopens. If
    // that effect ever drops the doneIntent reset, this handler
    // needs an explicit setDoneIntent('choose').
  }

  // Derived scheduler props — only valid when we're in the done +
  // schedule branch with a source AND a successful repurpose
  // response in hand. Computed unconditionally (memoised) so we
  // don't lose the SchedulerComposer's local state between renders.
  const schedulerProps = useMemo(() => {
    if (!source || !repurposeMutation.data) return null;
    const r = repurposeMutation.data;
    const channels = adaptationsToChannels(r);
    if (channels.length === 0) return null;
    return {
      source: {
        sourceType: toScheduleSourceType(source),
        sourceRef: toScheduleSourceRef(source),
        sourceTextHash: sourceTextHashFor(r),
      },
      title: r.sourceTitle,
      channels,
    };
  }, [source, repurposeMutation.data]);

  // Sheet width: standard for picker/done; widen for the scheduler
  // mount so the time picker + stagger chooser + confirm card don't
  // crowd a 512px column.
  const showingScheduler = stage === "done" && doneIntent === "schedule";
  const sheetWidthClass = showingScheduler ? "sm:max-w-2xl" : "sm:max-w-lg";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={cn(
          "flex w-full flex-col gap-0 p-0",
          sheetWidthClass,
        )}
      >
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            {showingScheduler ? (
              <>
                <CalendarClock className="size-4 text-primary" />
                Schedule these variants
              </>
            ) : (
              <>
                <Sparkles className="size-4 text-primary" />
                Repurpose to platforms
              </>
            )}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {showingScheduler
              ? "Pick a time, a stagger strategy, and any per-channel timing preferences. The smart-time engine handles tier-A audience timing."
              : stage === "done"
                ? "Your variants are ready — schedule them or save as drafts."
                : "We score each connected channel. Tick the ones you want to generate."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {stage === "loading" && <LoadingRows />}
          {stage === "empty" && <EmptyState count={recommendData?.connectedChannelsCount ?? 0} />}
          {stage === "error" && (
            <ErrorState
              message={
                recommendMutation.error instanceof Error
                  ? recommendMutation.error.message
                  : "Failed to score platforms"
              }
              onRetry={() => source && recommendMutation.mutate(source)}
            />
          )}
          {stage === "recommend" && (
            <RecommendationList
              recommendations={recommendations}
              selected={selected}
              onToggle={(channel, value) =>
                setSelected((prev) => ({ ...prev, [channel]: value }))
              }
            />
          )}
          {stage === "generating" && <GeneratingRows platforms={finalPlatforms} />}
          {stage === "done" && repurposeMutation.data && doneIntent === "choose" && (
            <DoneState response={repurposeMutation.data} />
          )}
          {showingScheduler && schedulerProps && (
            <SchedulerComposer
              // key on the source ref so SchedulerComposer remounts
              // (and resets its internal anchor/timezone/strategy)
              // when the parent flips to a different source mid-flow.
              key={schedulerProps.source.sourceRef ?? schedulerProps.source.sourceType}
              source={schedulerProps.source}
              title={schedulerProps.title}
              channels={schedulerProps.channels}
              onScheduled={handleScheduled}
            />
          )}
          {showingScheduler && !schedulerProps && (
            // Defensive — only reachable if doneIntent flipped to
            // schedule while source / response was unexpectedly null
            // (parent bug or mid-render reset). Surface a friendly
            // recoverable state instead of crashing the composer.
            <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
              Could not build a schedule from these variants. Close and try again.
            </div>
          )}
        </div>

        {/* Footer override: shadcn SheetFooter defaults to flex-col
            (column stack), which inverts the visual hierarchy of a
            ghost+primary pair on right-side sheets. Force a
            right-aligned row so primary actions land where the eye
            expects them. */}
        <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-3">
          {stage === "recommend" && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirm}
                disabled={finalPlatforms.length === 0 || !platformFitId}
              >
                {finalPlatforms.length > 0
                  ? `Generate ${finalPlatforms.length} variant${finalPlatforms.length === 1 ? "" : "s"}`
                  : "Generate variants"}
              </Button>
            </>
          )}
          {stage === "done" && doneIntent === "choose" && schedulerProps && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSaveAsDraft}
                className="gap-1.5"
              >
                <FileEdit className="size-3.5" />
                Save as draft
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setDoneIntent("schedule")}
                className="gap-1.5"
              >
                <CalendarClock className="size-3.5" />
                Schedule
              </Button>
            </>
          )}
          {stage === "done" && doneIntent === "choose" && !schedulerProps && (
            // Repurpose succeeded but produced zero schedulable
            // channels (e.g. all stubs filtered out). Only "Close"
            // makes sense — no schedule target.
            <Button type="button" size="sm" onClick={handleClose}>
              Close
            </Button>
          )}
          {showingScheduler && (
            // Left-aligned via `mr-auto` so this back-arrow doesn't
            // sit in the primary-action slot. The actual "Schedule"
            // submit button lives INSIDE <SchedulerComposer/>'s body
            // (with its own loading + entitlement gating).
            //
            // FOLLOW-UP: lifting that submit into this footer slot
            // would be more discoverable on shorter viewports — needs
            // a SchedulerComposer API change to expose either a
            // footerSlot prop or an imperative submit ref. Tracked
            // as a follow-up to this PR.
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDoneIntent("choose")}
              className="mr-auto gap-1.5"
            >
              <ArrowLeft className="size-3.5" />
              Back to variants
            </Button>
          )}
          {(stage === "empty" || stage === "error") && (
            <Button type="button" size="sm" onClick={handleClose}>
              Close
            </Button>
          )}
          {stage === "generating" && (
            <Button type="button" size="sm" disabled>
              <Loader2 className="mr-2 size-3 animate-spin motion-reduce:animate-none" />
              Generating
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ── Sub-components ────────────────────────────────────────

function LoadingRows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 rounded-md border p-3">
          <Skeleton className="size-4" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
        <AlertCircle className="size-4" aria-hidden />
        Failed to score platforms
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{message}</p>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function EmptyState({ count }: { count: number }) {
  return (
    <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
      {count === 0 ? (
        <>
          <p className="font-medium text-foreground">No channels connected yet.</p>
          <p className="mt-1 text-xs">
            Connect at least one channel (LinkedIn, X, etc.) before repurposing.
            Head to <em>Settings → Integrations</em>.
          </p>
        </>
      ) : (
        <p>
          The recommender couldn&apos;t score any of your {count} connected channels for
          this content. Try a longer source text or add media.
        </p>
      )}
    </div>
  );
}

function RecommendationList({
  recommendations,
  selected,
  onToggle,
}: {
  recommendations: PlatformRecommendation[];
  selected: Record<string, boolean>;
  onToggle: (channel: string, value: boolean) => void;
}) {
  return (
    <ol className="space-y-2">
      {recommendations.map((r) => {
        const display = getChannelDisplay(r.channel);
        const isHardBlocked = (r.hardBlocks?.length ?? 0) > 0;
        const band = BAND_STYLES[r.band];
        const checked = selected[r.channel] ?? false;
        return (
          <li
            key={r.channel}
            className="flex items-start gap-3 rounded-md border bg-card p-3 hover:bg-muted/40"
          >
            <Checkbox
              id={`repurpose-${r.channel}`}
              checked={checked}
              disabled={isHardBlocked}
              onCheckedChange={(v) => onToggle(r.channel, v === true)}
              className="mt-1"
            />
            <label
              htmlFor={`repurpose-${r.channel}`}
              className={`flex-1 cursor-pointer space-y-1 ${
                isHardBlocked ? "cursor-not-allowed opacity-60" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${band.dot}`} aria-hidden />
                <span className="text-sm font-medium">{display.label}</span>
                <Badge variant="outline" className={`text-[10px] ${band.chip}`}>
                  {band.label}
                </Badge>
                {!isHardBlocked && (
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {r.fitScore}/100
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {r.rationale}
                {isHardBlocked && r.hardBlocks && r.hardBlocks.length > 0 && (
                  <span className="ml-1 text-[10px] uppercase tracking-wide opacity-70">
                    [{r.hardBlocks.join(", ")}]
                  </span>
                )}
              </p>
            </label>
          </li>
        );
      })}
    </ol>
  );
}

function GeneratingRows({ platforms }: { platforms: string[] }) {
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      {platforms.map((p) => {
        const display = getChannelDisplay(p);
        return (
          <div
            key={p}
            className="flex items-center gap-3 rounded-md border bg-card p-3"
          >
            <Loader2
              className="size-4 animate-spin text-muted-foreground"
              aria-hidden
            />
            <span className="text-sm">Writing for {display.label}…</span>
          </div>
        );
      })}
      <span className="sr-only">Generating variants for {platforms.length} platform{platforms.length === 1 ? "" : "s"}</span>
    </div>
  );
}

function VariantPreview({ variant: v }: { variant: RepurposeResponse["adaptations"][number] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-[11px] uppercase text-muted-foreground">
        {v.contentType}
        {v.estimatedEngagement > 0 && (
          <span className="tabular-nums">
            · {v.estimatedEngagement}/10 engagement
          </span>
        )}
      </div>
      <p
        className={`whitespace-pre-line text-sm ${expanded ? "" : "line-clamp-6"}`}
      >
        {v.content}
      </p>
      {v.content.length > 280 && (
        <button
          type="button"
          onClick={() => setExpanded((s) => !s)}
          className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function DoneState({ response }: { response: RepurposeResponse }) {
  // Group adaptations by platform for display. X returns two
  // adaptations (post + thread); the rest return one each.
  const byPlatform = response.adaptations.reduce<
    Record<string, RepurposeResponse["adaptations"]>
  >((acc, a) => {
    (acc[a.platform] ??= []).push(a);
    return acc;
  }, {});
  return (
    <div className="space-y-3">
      {response.idempotent && (
        // Visible cue (in addition to the sonner toast) so a user who
        // dismisses the toast still sees these are prior variants,
        // not fresh ones.
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Showing your previous repurpose for this content (no new variants generated).
        </div>
      )}
      {Object.entries(byPlatform).map(([platform, variants]) => {
        const display = getChannelDisplay(platform);
        return (
          <div key={platform} className="rounded-md border bg-card">
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <span className="text-sm font-medium">{display.label}</span>
              <Badge variant="outline" className="text-[10px]">
                {variants.length} variant{variants.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <div className="space-y-2 px-3 py-2">
              {variants.map((v) => (
                <VariantPreview key={`${platform}-${v.contentType}`} variant={v} />
              ))}
            </div>
          </div>
        );
      })}
      {response.failedPlatforms.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-destructive">
            <AlertCircle className="size-3.5" />
            Failed
          </div>
          <ul className="space-y-0.5 text-xs">
            {response.failedPlatforms.map((f) => {
              const display = getChannelDisplay(f.platform);
              return (
                <li key={f.platform}>
                  <span className="font-medium">{display.label}</span>:{" "}
                  <span className="text-muted-foreground">{f.error}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
