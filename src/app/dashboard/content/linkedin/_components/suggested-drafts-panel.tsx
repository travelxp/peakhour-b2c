"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Sparkles, X } from "lucide-react";
import type {
  GenerateFromProfileResponse,
  SuggestedDraft,
} from "@/lib/api/linkedin-content";

/**
 * SUGGESTED_DRAFTS_QUERY_KEY — the cache key shared with the onboarding
 * launch page. The launch page writes the generate-from-profile result
 * via `queryClient.setQueryData(SUGGESTED_DRAFTS_QUERY_KEY, response)`;
 * this panel reads it back via `useQuery` with the same key + a
 * `queryFn` that resolves to `null` when no data is in cache yet
 * (no network call — this is pure in-memory state coordination).
 *
 * Page refresh clears the cache, which is intentional for v1: the
 * suggested-drafts surface is a "just-onboarded" affordance, not a
 * persistent queue. The drafts themselves persist in `cnt_drafts`
 * (status="ready", source="ai_generated") and a future iteration will
 * fetch them from `/v1/content/library` so the panel survives reloads.
 */
export const SUGGESTED_DRAFTS_QUERY_KEY = ["linkedin-suggested-drafts"] as const;

interface Props {
  /** Called when the user clicks "Use this draft" — the parent threads
   *  the post text into the PostComposer's seedText prop. */
  onUseDraft: (text: string) => void;
}

/**
 * SuggestedDraftsPanel — surfaces the LinkedIn post drafts generated
 * at onboarding completion. Empty state (no cached drafts) renders
 * nothing — the panel just disappears, the composer takes the full
 * width. After the user clicks "Use this draft" on a card, the card
 * is dismissed (locally) and the composer receives the text.
 *
 * The panel is intentionally non-modal — the user can browse drafts
 * while typing in the composer. Side-by-side suggestion + authoring
 * matches how the user actually works.
 */
export function SuggestedDraftsPanel({ onUseDraft }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(true);
  // Locally-dismissed draftIds — once a user picks a draft (or X's it),
  // it disappears from this panel but stays in cnt_drafts so it's still
  // discoverable from the broader Drafts list (when that surface lands).
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // staleTime: Infinity — the cache is populated synchronously by the
  // launch page; we never refetch in this panel (no network query to
  // make — the data is hand-fed). Empty initialData lets the panel
  // render the "no drafts" branch cleanly before anything's stashed.
  const { data } = useQuery<GenerateFromProfileResponse | null>({
    queryKey: SUGGESTED_DRAFTS_QUERY_KEY,
    queryFn: () => null,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const drafts = (data?.posts ?? []).filter((d) => !dismissedIds.has(d.draftId));
  if (drafts.length === 0) return null;

  function dismiss(draftId: string) {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(draftId);
      return next;
    });
    // If the user dismisses everything, drop the cache entry so the
    // panel doesn't reappear on next tab switch via stale cache.
    if (drafts.length === 1) {
      queryClient.setQueryData(SUGGESTED_DRAFTS_QUERY_KEY, null);
    }
  }

  function use(draft: SuggestedDraft) {
    const composed = `${draft.hook}\n\n${draft.body}`;
    onUseDraft(composed);
    dismiss(draft.draftId);
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-primary/20 bg-primary/5">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer flex-row items-center justify-between gap-3 space-y-0 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h3 className="text-base leading-none font-semibold">
                Suggested for you
              </h3>
              <Badge
                variant="outline"
                className="border-primary/40 text-[10px] uppercase tracking-wide"
              >
                {drafts.length} draft{drafts.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <ChevronDown
              className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            <p className="mb-3 text-xs text-muted-foreground">
              We drafted these from your business profile. Click <em>Use this draft</em> to load one into the composer; you can edit, then publish.
            </p>
            <ol className="space-y-2">
              {drafts.map((draft, i) => (
                <SuggestedDraftCard
                  key={draft.draftId}
                  rank={i + 1}
                  draft={draft}
                  onUse={() => use(draft)}
                  onDismiss={() => dismiss(draft.draftId)}
                />
              ))}
            </ol>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

const ANGLE_LABEL: Record<SuggestedDraft["angle"], string> = {
  industry_insight: "Industry insight",
  customer_story: "Customer story",
  thought_leadership: "Thought leadership",
  product_or_service_highlight: "Product highlight",
  behind_the_scenes: "Behind the scenes",
  trend_observation: "Trend observation",
  founder_personal: "Founder personal",
  data_point: "Data point",
  lessons_learned: "Lessons learned",
  how_to_practical: "How-to",
};

function SuggestedDraftCard({
  rank,
  draft,
  onUse,
  onDismiss,
}: {
  rank: number;
  draft: SuggestedDraft;
  onUse: () => void;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const tierBadgeText =
    draft.hookScore.tier === "rules"
      ? "rules"
      : draft.hookScore.tier === "industry"
        ? "industry"
        : "personal";

  return (
    <li className="rounded-md border bg-card">
      <div className="flex items-start gap-3 p-3">
        <span className="w-5 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
          {rank}.
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="block w-full text-left"
            aria-expanded={expanded}
          >
            <p
              className={`whitespace-pre-line text-sm font-medium ${expanded ? "" : "line-clamp-2"}`}
            >
              {draft.hook}
            </p>
          </button>
          {expanded && (
            <p className="whitespace-pre-line text-xs text-muted-foreground">
              {draft.body}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <Badge
              variant="secondary"
              className="text-[10px] uppercase tracking-wide"
            >
              {ANGLE_LABEL[draft.angle]}
            </Badge>
            {draft.audienceSegment ? (
              <span>for {draft.audienceSegment}</span>
            ) : null}
            <span
              title={`Frequency ${draft.hookScore.breakdown.length} / Opener ${draft.hookScore.breakdown.opener} / Specific ${draft.hookScore.breakdown.specificData} / Audience ${draft.hookScore.breakdown.audienceNoun} / Active ${draft.hookScore.breakdown.activeVoice} / Rhythm ${draft.hookScore.breakdown.rhythm}`}
            >
              Hook DNA {draft.hookScore.score}/100 ·{" "}
              <span className="uppercase">{tierBadgeText}</span>
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={onUse}
            className="h-7 text-xs"
          >
            Use this draft
          </Button>
          <button
            type="button"
            onClick={onDismiss}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss this suggestion"
            title="Dismiss this suggestion"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
      {draft.rationale ? (
        <p
          className="border-t px-3 py-2 text-[11px] italic text-muted-foreground"
          title={draft.rationale}
        >
          {draft.rationale}
        </p>
      ) : null}
    </li>
  );
}
