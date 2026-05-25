"use client";

import { useEffect, useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { Sparkles, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import {
  recommendPlatforms,
  repurpose,
  getChannelDisplay,
  BAND_STYLES,
  type RepurposeSource,
  type PlatformRecommendation,
  type RepurposeResponse,
} from "@/lib/api/repurpose";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Caller-provided source. When the sheet opens we fire
   *  /recommend-platforms with this source; when the user confirms
   *  the platform picker, /repurpose runs with the same source. */
  source: RepurposeSource | null;
}

/**
 * Shared "Repurpose to platforms" sheet used from every entry point
 * (SuggestedDraftCard, Beehiiv row action, paste-and-repurpose
 * composer). Owns the recommend → confirm → generate flow end-to-end:
 *
 *   1. Open → fires POST /v1/content/recommend-platforms with the
 *      source. Renders skeletons while the recommender scores.
 *   2. Recommendations land → renders one row per scored channel
 *      with band badge + rationale + checkbox. Green pre-checked,
 *      amber pre-checked, grey unchecked (the user can override).
 *      Hard-blocked greys are checkbox-disabled with a tooltip.
 *   3. User clicks Generate → fires POST /v1/content/repurpose with
 *      platforms[] + platformFitId. Renders per-channel progress.
 *   4. Variants land → renders preview cards with "Open in composer"
 *      CTAs. Stub channels (Coming soon) render as a separate row
 *      so the user sees the recommender did its job even though
 *      publishing isn't wired.
 *
 * No internal hook — the state is sheet-scoped and unmounts on
 * close, so co-locating the mutations + selection state here keeps
 * the surface area small.
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
        toast.info("No variants generated — every selected channel is either pending or failed.");
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

  // Reset everything when the sheet opens with a new source.
  useEffect(() => {
    if (!open || !source) return;
    setSelected({});
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

  const stage: "loading" | "recommend" | "generating" | "done" | "empty" =
    repurposeMutation.isPending
      ? "generating"
      : repurposeMutation.isSuccess
        ? "done"
        : // `isIdle` (mutation hasn't run yet) AND we have a source =
          // we're about to call mutate via the reset effect — treat as
          // loading instead of letting the fallback "recommend" branch
          // render an empty list for one frame.
          recommendMutation.isPending || (recommendMutation.isIdle && source !== null)
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" />
            Repurpose to platforms
          </SheetTitle>
          <SheetDescription className="text-xs">
            {stage === "done"
              ? "Your variants are ready — open each in its composer to publish."
              : "We score each connected channel. Tick the ones you want to generate."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {stage === "loading" && <LoadingRows />}
          {stage === "empty" && <EmptyState count={recommendData?.connectedChannelsCount ?? 0} />}
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
          {stage === "done" && repurposeMutation.data && (
            <DoneState response={repurposeMutation.data} />
          )}
        </div>

        <SheetFooter className="border-t px-6 py-3">
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
                Generate {finalPlatforms.length || ""}{" "}
                variant{finalPlatforms.length === 1 ? "" : "s"}
              </Button>
            </>
          )}
          {(stage === "done" || stage === "empty") && (
            <Button type="button" size="sm" onClick={handleClose}>
              Close
            </Button>
          )}
          {stage === "generating" && (
            <Button type="button" size="sm" disabled>
              <Loader2 className="mr-2 size-3 animate-spin" />
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
