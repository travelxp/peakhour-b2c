"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/molecules/data-table";
import {
  SENTIMENT_CONFIG,
  SHELF_LIFE_LABELS,
  label,
} from "@/lib/content-labels";
import { formatDate } from "@/lib/locale";
import type { UserPreferences } from "@/lib/auth";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info, Loader2, RefreshCw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Per-row Re-analyse button. Wired to POST /v1/content/drafts/:id/retag
 * (api#406) — wipes the cnt_content_tags row + resets the draft +
 * invokes tagDraft synchronously. Used in the Subtype cell so users
 * have a click target when a row looks wrong (derived classification,
 * unclassified sentinel, garbage value, missing rationale).
 *
 * Replaces the misleading text-only tooltip fallback at this file's
 * RationaleTooltip ("re-run analyse to capture") which had no action.
 */
interface RetagResponse {
  success: boolean;
  error?: string;
  status?: string;
}

/**
 * Translate the api#406 retag-result `error` strings (which can carry
 * codey internal prefixes like `preflight:image_only`) into copy users
 * can actually act on. Unrecognised errors fall through unchanged —
 * better to show an unfriendly string than to swallow real info
 * (round-1 review F2 on api#406).
 */
function friendlyRetagError(raw: string | undefined): string {
  if (!raw) return "Re-analyse completed without producing tags.";
  // Ground-truth preflight codes come from helpers/draft-unprocessable.ts.
  // Round-2 review F1: the previous "preflight:too_short" branch was
  // dead — actual code is "content_too_short". Fixed.
  if (raw.startsWith("preflight:image_only")) {
    return "This newsletter is image-only and has no analysable text yet.";
  }
  if (raw.startsWith("preflight:content_too_short")) {
    return "Newsletter content is too short to analyse — wait for the full text to ingest, then try again.";
  }
  if (raw.startsWith("preflight:")) {
    return "Newsletter content didn't pass the preflight checks — open the draft to review.";
  }
  // Slightly more robust than the round-1 `includes("All") && includes("sub-skills failed")` —
  // load-bearing substring is "sub-skills failed" (review F4).
  if (raw.includes("sub-skills failed")) {
    return "AI tagger is having a moment — wait a few seconds and try again.";
  }
  return raw;
}

function ReanalyseDraftButton({ draftId }: { draftId: string }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    // api.post unwraps the `data` envelope + throws ApiError on
    // non-2xx (see src/lib/api.ts:160-167) — no manual res.ok check
    // needed.
    mutationFn: () =>
      api.post<RetagResponse>(`/v1/content/drafts/${draftId}/retag`),
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Newsletter re-analysed.");
      } else {
        // Non-success path: surface the mapped reason via toast.warning
        // (info-level — the call completed, the model just didn't
        // produce usable tags).
        toast.warning(friendlyRetagError(data.error));
      }
      // Same query keys the page.tsx uses (line 134-135) so the table
      // refetches with the new tag row spliced in.
      qc.invalidateQueries({ queryKey: ["content-library-all"] });
      qc.invalidateQueries({ queryKey: ["content-stats"] });
    },
    onError: (err) => {
      // api.post throws ApiError (extends Error) — message surfaces as
      // err.message. For TAG_ATTEMPTS_CAP_EXCEEDED / RETAG_COOLDOWN
      // the api returns 429 + the message already reads to users.
      toast.error(err instanceof Error ? err.message : "Re-analyse failed");
    },
  });
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          aria-label="Re-analyse this newsletter"
        >
          {mutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p>Re-analyse this newsletter</p>
      </TooltipContent>
    </Tooltip>
  );
}

const FORMAT_LABELS: Record<string, string> = {
  article: "Article",
  newsletter: "Newsletter",
  advertorial: "Advertorial",
  pr: "PR",
};
const FORMAT_OPTIONS = ["newsletter", "article", "advertorial", "pr"] as const;
type ContentFormat = (typeof FORMAT_OPTIONS)[number];

export interface Draft {
  _id: string;
  title: string;
  subtitle?: string;
  source: string;
  status: string;
  publishedAt: string;
  webUrl?: string;
  thumbnailUrl?: string;
  readingTimeMin?: number;
  /**
   * Set by the API when an automated pipeline (today: AI tagger hits
   * retry cap; future: deterministic preflight gates) determines no
   * further automated processing will help. Surfaced as an info icon
   * + tooltip next to "Not scored" in the Ad Score column so users
   * understand WHY a score will never appear rather than waiting
   * indefinitely. `code` is stable across businesses for analytics;
   * `message` is the human-readable, possibly business-contextual
   * tooltip text.
   */
  unprocessable?: {
    code:
      | "ai_persistent_failure"
      | "content_too_short"
      | "image_only"
      | "unsupported_language"
      | "duplicate_content"
      | "boilerplate_only"
      | "ai_no_extractable_tags";
    message: string;
    detectedAt: string;
  };
  tags: {
    sectors: { name: string; weight: number; rationale?: string }[];
    /**
     * TRUE when sectors were filled by the deterministic title-keyword
     * fallback rather than the AI (peakhour-api#402, mongo#147). The
     * column renders a small "auto" badge so users know this row's
     * sector tagging is synthetic and may need review. Cohort math
     * downstream already de-weights via the lower per-row `weight`.
     */
    sectorsDerived?: boolean;
    companies: { name: string; role: string; sentiment?: string }[];
    contentFormat?: ContentFormat;
    userOverriddenFormat?: boolean;
    contentType: string;
    contentTypeRationale?: string;
    /**
     * TRUE when contentType was filled by the deterministic source-derived
     * fallback (newsletter-class source → first taxonomy entry) rather than
     * the AI (peakhour-api#401, mongo#146). Same UX as sectorsDerived.
     */
    contentTypeDerived?: boolean;
    sentiment: string;
    sentimentRationale?: string;
    shelfLife: string;
    shelfLifeRationale?: string;
    urgency?: number;
    urgencyRationale?: string;
    adPotentialScore: number;
    adPotentialAngle?: string;
    topKeywords: string[];
    audienceRelevance: { segment: string; relevance: number }[];
  } | null;
  /**
   * Per-row platform-fit summary from the rules-based recommender
   * (peakhour-api PR-F.1: GET /library?includeRepurposeFit=true). Drives:
   *   - the Repurpose row-action button's colour (green/amber/grey)
   *   - the "Repurposable" filter chip (greenBand=true)
   *   - the platform-suitability rationale shown in the hover tooltip
   *
   * Absent when:
   *   - the api wasn't passed includeRepurposeFit (old callsites)
   *   - the business has zero connected channels
   *   - the draft has no `plainText` hydrated (conservative — don't
   *     score raw HTML; the persisting recommender re-scores when the
   *     user opens the sheet)
   */
  repurposeFit?: {
    topBand: "green" | "amber" | "grey";
    topChannel: string;
    topFitScore: number;
    topRationale: string;
    breakdown: { channel: string; band: "green" | "amber" | "grey"; fitScore: number }[];
  };
}

/** Inline format Select — primary classification axis, user-controlled. */
function FormatSelectCell({ row }: { row: Draft }) {
  const queryClient = useQueryClient();
  const current = row.tags?.contentFormat;
  const userPinned = !!row.tags?.userOverriddenFormat;
  const [optimistic, setOptimistic] = useState<ContentFormat | undefined>(undefined);
  // Resolve to the user's pending choice first, then the server value.
  // Stays undefined for legacy rows so the placeholder ("—") makes it clear
  // the format hasn't been classified yet — vs. the trigger silently lying
  // by showing "Newsletter" for every unset row.
  const value = optimistic ?? current;
  const isUnset = !value;

  const mutation = useMutation({
    mutationFn: (next: ContentFormat) =>
      api.patch(`/v1/content/library/${row._id}/format`, { contentFormat: next }),
    onMutate: (next) => {
      setOptimistic(next);
    },
    onSettled: () => {
      // Always clear optimistic state — refetched server value (or the
      // pre-mutation value on error) becomes the source of truth again.
      queryClient.invalidateQueries({ queryKey: ["content-library-all"] });
      setOptimistic(undefined);
    },
  });

  const tooltipText = userPinned
    ? "User-set format. AI re-tags will preserve this pick."
    : current
      ? "AI-defaulted format. Click to override."
      : "No format set yet. Click to assign.";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div onClick={(e) => e.stopPropagation()}>
          <Select
            // Pass "" rather than undefined to keep Radix in controlled mode
            // even when the row has no contentFormat yet — avoids the
            // uncontrolled→controlled dev warning when the user picks a value.
            value={value ?? ""}
            onValueChange={(v) => mutation.mutate(v as ContentFormat)}
          >
            <SelectTrigger
              className={`h-7 w-30 text-xs ${isUnset ? "text-muted-foreground italic" : ""}`}
            >
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {FORMAT_OPTIONS.map((f) => (
                <SelectItem key={f} value={f} className="text-xs">
                  {FORMAT_LABELS[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/** Wraps a child in a Tooltip that shows the AI's rationale, or a hint when missing. */
function RationaleTooltip({
  children,
  rationale,
  fallback = "No reasoning recorded — re-run analyse to capture.",
}: {
  children: React.ReactNode;
  rationale?: string;
  fallback?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{children}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm whitespace-pre-wrap text-xs">
        <p>{rationale || fallback}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Build the table columns for the beehiiv content list. `onRepurpose`
 * is the row-action callback that opens the shared RepurposeSheet for
 * the clicked draft — added so the Repurpose entry-point is reachable
 * from both card view AND table view (was card-only, missed by
 * default-table-view users).
 */
export function getContentColumns(
  prefs: UserPreferences | null,
  onRepurpose: (draftId: string) => void,
): ColumnDef<Draft, unknown>[] {
  return [
  {
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Title" />
    ),
    cell: ({ row }) => (
      <div className="max-w-sm">
        <span className="font-medium line-clamp-1">{row.getValue("title")}</span>
        {row.original.subtitle && (
          <span className="block text-xs text-muted-foreground line-clamp-1">
            {row.original.subtitle}
          </span>
        )}
      </div>
    ),
    enableHiding: false,
  },
  {
    id: "contentFormat",
    accessorFn: (row) => row.tags?.contentFormat ?? "",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Format" />
    ),
    cell: ({ row }) => <FormatSelectCell row={row.original} />,
    filterFn: (row, id, value) => {
      if (!Array.isArray(value) || value.length === 0) return true;
      const rowValue = String(row.getValue(id)).toLowerCase();
      return value.some((v: string) => v.toLowerCase() === rowValue);
    },
    enableSorting: false,
  },
  {
    id: "contentType",
    accessorFn: (row) => row.tags?.contentType ?? "",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Subtype" />
    ),
    cell: ({ row }) => {
      const ct = row.original.tags?.contentType;
      const derived = row.original.tags?.contentTypeDerived === true;
      const rationale = row.original.tags?.contentTypeRationale;
      // Show the Re-analyse icon when the row "looks problematic":
      //   - contentType is the unclassified sentinel
      //   - contentTypeDerived flag is on (synthetic origin)
      //   - rationale is missing (the case the old text-only tooltip
      //     "re-run analyse to capture" used to flag with no action)
      // Closes the user-reported gap: "On hover shows reanalyse, but
      // where to click?" — there is now a click target on every row
      // where re-analysis would actually help.
      const showRetry =
        !ct || ct === "unclassified" || derived || !rationale;
      if (!ct) {
        // No badge to render — surface the Re-analyse action alone with
        // an em-dash placeholder so the cell isn't empty.
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">—</span>
            <ReanalyseDraftButton draftId={row.original._id} />
          </div>
        );
      }
      // Truncation budget (round-1 review F3 on api#406):
      //   - max-w-60 (= 240px) fits the canonical longest entry in
      //     quests.travel taxonomy ("Daily intelligence digest
      //     (newsletter)" ≈ 228px at text-xs) without truncation
      //   - on lg screens, expand to max-w-80 (= 320px) so longer
      //     taxonomies (some orgs run 12+ entries) get more room
      //   - the badge keeps `truncate` as a defensive overflow guard
      //     for the rare malformed AI emission the sanitiser misses
      const labelText = label(undefined, ct);
      const badge = (
        <Badge
          variant="outline"
          className={`max-w-60 truncate text-xs lg:max-w-80 ${ct === "unclassified" ? "text-muted-foreground italic" : ""}`}
        >
          {labelText}
          {/* Inline "auto" marker — only when the deterministic source-derived
            * fallback fired (api#401). Tooltip explains so users don't think
            * the AI confidently chose this. Same UX pattern as the
            * sectors-derived badge below. */}
          {derived ? (
            <span className="ml-1 text-[10px] uppercase tracking-wide text-amber-700">auto</span>
          ) : null}
        </Badge>
      );
      // Tooltip preference: if the badge is visually truncated, the
      // full contentType MUST be reachable somehow. Compose:
      //   line 1 = full contentType (always — recovers truncated text)
      //   line 2 = derivation explainer OR AI rationale
      // This is what the round-1 review called the "tooltip should
      // expose full truncated contentType" gap.
      const explainer = derived
        ? "AI tagger couldn't classify this content; we auto-filled the subtype from the source's default taxonomy. Click the refresh icon to re-analyse."
        : rationale;
      const tooltipText = explainer ? `${labelText}\n\n${explainer}` : labelText;
      return (
        <div className="flex items-center gap-1.5">
          <RationaleTooltip rationale={tooltipText}>
            {badge}
          </RationaleTooltip>
          {showRetry ? <ReanalyseDraftButton draftId={row.original._id} /> : null}
        </div>
      );
    },
    filterFn: (row, id, value) => {
      if (!Array.isArray(value) || value.length === 0) return true;
      const rowValue = String(row.getValue(id)).toLowerCase();
      return value.some((v: string) => v.toLowerCase() === rowValue);
    },
    enableSorting: false,
  },
  {
    id: "sectors",
    accessorFn: (row) => row.tags?.sectors?.map((s) => s.name).join(", ") ?? "",
    header: "Sectors",
    cell: ({ row }) => {
      const sectors = row.original.tags?.sectors;
      const derived = row.original.tags?.sectorsDerived === true;
      if (!sectors?.length) return <span className="text-muted-foreground">—</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {sectors.slice(0, 2).map((s, i) => (
            <RationaleTooltip
              key={s.name}
              rationale={
                derived
                  ? "AI tagger couldn't extract sectors; we derived these from the title's keywords. Open the draft to review or override."
                  : s.rationale
              }
            >
              <Badge variant="secondary" className="text-xs">
                {label(undefined, s.name)}
                {/* "auto" marker only on the first chip when the title-keyword
                  * fallback fired (api#402) — avoids polluting every row with
                  * a chip-level marker but still flags the synthetic origin. */}
                {derived && i === 0 ? (
                  <span className="ml-1 text-[10px] uppercase tracking-wide text-amber-700">auto</span>
                ) : null}
              </Badge>
            </RationaleTooltip>
          ))}
        </div>
      );
    },
    enableSorting: false,
  },
  {
    id: "sentiment",
    accessorFn: (row) => row.tags?.sentiment ?? "",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Sentiment" />
    ),
    cell: ({ row }) => {
      const value = row.original.tags?.sentiment;
      if (!value) return null;
      const config = SENTIMENT_CONFIG[value];
      const badge = config ? (
        <Badge className={`text-xs ${config.bg} ${config.color} border-0`}>
          {config.label}
        </Badge>
      ) : (
        <Badge variant="outline" className="text-xs">{value}</Badge>
      );
      return (
        <RationaleTooltip rationale={row.original.tags?.sentimentRationale}>
          {badge}
        </RationaleTooltip>
      );
    },
    filterFn: (row, id, value) => {
      if (!Array.isArray(value) || value.length === 0) return true;
      const rowValue = String(row.getValue(id)).toLowerCase();
      return value.some((v: string) => v.toLowerCase() === rowValue);
    },
    enableSorting: false,
  },
  {
    id: "adScore",
    accessorFn: (row) => row.tags?.adPotentialScore ?? 0,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Ad Score" />
    ),
    cell: ({ row }) => {
      const score = row.original.tags?.adPotentialScore;
      const unprocessable = row.original.unprocessable;
      if (score == null) {
        // When the API marked this draft unprocessable (cap hit, gate
        // fired, etc.), surface the reason as a tooltip so the user
        // doesn't sit waiting for a score that will never come. The
        // reason `message` is pre-rendered by the API — display as-is.
        // Defence-in-depth: if the API ever ships an empty message,
        // fall through to plain "Not scored" rather than render an
        // empty hover bubble. The API contract requires a non-empty
        // string (schema maxLength 512, no minLength but the writer
        // always populates it) — this guard is for forward-compat.
        if (unprocessable && unprocessable.message) {
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                {/* tabIndex makes the span focusable so keyboard
                    users can reach the tooltip — Radix auto-opens on
                    focus once the trigger is focusable. stopPropagation
                    on click + pointerdown — the row is wired to
                    navigate on click, and Radix opens its tooltip on
                    pointerdown; without both, tapping the Info icon
                    routes away and the tooltip closes immediately.
                    Mirrors the Repurpose button pattern elsewhere on
                    this page. */}
                <span
                  className="flex items-center gap-1 rounded-sm text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  tabIndex={0}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  Can&apos;t score
                  <Info className="size-3 text-amber-500" aria-label="Why not scored?" />
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>{unprocessable.message}</p>
              </TooltipContent>
            </Tooltip>
          );
        }
        return <span className="text-xs text-muted-foreground">Not scored</span>;
      }
      const color =
        score >= 8
          ? "bg-green-500"
          : score >= 6
            ? "bg-amber-500"
            : score >= 4
              ? "bg-orange-400"
              : "bg-red-400";
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${color}`}
                  style={{ width: `${score * 10}%` }}
                />
              </div>
              <span className="text-xs font-medium">{score}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Ad Potential Score: {score}/10</p>
          </TooltipContent>
        </Tooltip>
      );
    },
  },
  {
    id: "shelfLife",
    accessorFn: (row) => row.tags?.shelfLife ?? "",
    header: "Shelf Life",
    cell: ({ row }) => {
      const text = label(SHELF_LIFE_LABELS, row.original.tags?.shelfLife);
      return (
        <RationaleTooltip rationale={row.original.tags?.shelfLifeRationale}>
          <span className="text-xs text-muted-foreground">{text}</span>
        </RationaleTooltip>
      );
    },
    filterFn: (row, id, value) => {
      if (!Array.isArray(value) || value.length === 0) return true;
      const rowValue = String(row.getValue(id)).toLowerCase();
      return value.some((v: string) => v.toLowerCase() === rowValue);
    },
    enableSorting: false,
  },
  {
    accessorKey: "publishedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Published" />
    ),
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {formatDate(row.original.publishedAt, prefs)}
      </span>
    ),
  },
  {
    // Repurpose row-action — opens the shared RepurposeSheet for the
    // row's draft. stopPropagation on both click + pointerDown so the
    // row's onClick (router.push to the detail page) doesn't fire when
    // the user only wanted to open the platform recommender. Mirrors
    // the card-view Repurpose pattern at page.tsx:800.
    //
    // Colour band comes from the api's rules-based platform-fit preview
    // (peakhour-api PR-F.1). When the band is absent (legacy callers,
    // no plainText hydrated, no connected channels) the button keeps
    // its neutral ghost styling — the user can still click and the
    // persisting recommender will score on open.
    id: "actions",
    enableSorting: false,
    enableHiding: false,
    header: "",
    // STICKY-RIGHT — the Repurpose action stays visible regardless of
    // viewport width or horizontal overflow on the rest of the table.
    // The wrapping `overflow-hidden` on the table container was clipping
    // the actions column on narrow viewports (user-reported "Repurpose
    // button hidden on the right"). With sticky, the cell pins to the
    // right edge and the rest of the table content scrolls / shrinks
    // behind it. Background + shadow provide a visual edge.
    meta: {
      thClassName:
        "sticky right-0 bg-background z-10 shadow-[-4px_0_4px_-2px_rgba(0,0,0,0.05)]",
      // `group-hover:bg-muted/50` mirrors the TableRow's hover background
      // so the sticky cell doesn't form a visible seam — without this,
      // hover paints muted/50 on every non-sticky cell and bg-background
      // on the sticky one. The TableRow needs `group` set on it (see
      // page.tsx) for this group-hover variant to fire.
      tdClassName:
        "sticky right-0 bg-background group-hover:bg-muted/50 z-10 shadow-[-4px_0_4px_-2px_rgba(0,0,0,0.05)]",
    },
    filterFn: (row, _id, value) => {
      // "Repurposable" filter chip → keep rows whose top platform-fit
      // band is in the selected set (typically [green], sometimes
      // [green, amber]). Rows without a fit summary fall through ONLY
      // when the filter is unset; an active filter excludes them.
      if (!Array.isArray(value) || value.length === 0) return true;
      const band = row.original.repurposeFit?.topBand;
      if (!band) return false;
      return value.includes(band);
    },
    accessorFn: (row) => row.repurposeFit?.topBand ?? "",
    cell: ({ row }) => <RepurposeActionCell draft={row.original} onRepurpose={onRepurpose} />,
  },
  ];
}

/**
 * Repurpose row-action cell. The button's variant + colour reflects the
 * top platform-fit band:
 *   green  → strong fit at least one channel  → emphasised default-ish
 *   amber  → workable but not strongest        → muted amber
 *   grey   → no fit (or only hard-blocks)      → ghost (unchanged)
 *   absent → unknown (no preview)              → plain ghost
 *
 * Hover tooltip surfaces the recommender's rationale (the
 * platform-suitability reason the user asked to see) + a per-channel
 * breakdown.
 */
function RepurposeActionCell({
  draft,
  onRepurpose,
}: {
  draft: Draft;
  onRepurpose: (draftId: string) => void;
}) {
  const fit = draft.repurposeFit;
  // Band-specific class — only differentiate on the visually meaningful
  // bands (green, amber). Grey + absent both use the neutral ghost so
  // a draft with no preview doesn't look "worse" than a draft with a
  // grey fit (they're functionally the same: nothing recommended).
  const bandClass =
    fit?.topBand === "green"
      ? "text-green-700 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/40"
      : fit?.topBand === "amber"
        ? "text-amber-700 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
        : "";

  const trigger = (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className={`h-7 text-xs ${bandClass}`}
      onClick={(e) => {
        e.stopPropagation();
        onRepurpose(draft._id);
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Share2 className="mr-1 size-3" />
      Repurpose
    </Button>
  );

  // No preview available → keep the neutral button without a tooltip.
  // The button itself still works; the user just doesn't get a peek
  // until the recommender persists on click.
  if (!fit) return <div className="flex justify-end">{trigger}</div>;

  return (
    <div className="flex justify-end">
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <p className="font-medium text-xs">
            Top fit: {fit.topChannel} ({fit.topBand})
          </p>
          <p className="text-xs text-muted-foreground mt-1">{fit.topRationale}</p>
          {fit.breakdown.length > 1 && (
            <div className="mt-2 border-t pt-1 text-[10px] text-muted-foreground">
              <p className="font-medium mb-0.5">All channels:</p>
              {fit.breakdown.map((b) => (
                <p key={b.channel} className="font-mono">
                  {b.channel}: {b.band} ({b.fitScore})
                </p>
              ))}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
