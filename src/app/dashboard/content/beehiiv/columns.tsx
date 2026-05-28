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
import { Info, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    companies: { name: string; role: string; sentiment?: string }[];
    contentFormat?: ContentFormat;
    userOverriddenFormat?: boolean;
    contentType: string;
    contentTypeRationale?: string;
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
      if (!ct) return <span className="text-muted-foreground">—</span>;
      return (
        <RationaleTooltip rationale={row.original.tags?.contentTypeRationale}>
          <Badge
            variant="outline"
            className={`text-xs ${ct === "unclassified" ? "text-muted-foreground italic" : ""}`}
          >
            {label(undefined, ct)}
          </Badge>
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
    id: "sectors",
    accessorFn: (row) => row.tags?.sectors?.map((s) => s.name).join(", ") ?? "",
    header: "Sectors",
    cell: ({ row }) => {
      const sectors = row.original.tags?.sectors;
      if (!sectors?.length) return <span className="text-muted-foreground">—</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {sectors.slice(0, 2).map((s) => (
            <RationaleTooltip key={s.name} rationale={s.rationale}>
              <Badge variant="secondary" className="text-xs">
                {label(undefined, s.name)}
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
    id: "actions",
    enableSorting: false,
    enableHiding: false,
    header: "",
    cell: ({ row }) => (
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onRepurpose(row.original._id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          title="Score connected platforms and generate variants"
        >
          <Share2 className="mr-1 size-3" />
          Repurpose
        </Button>
      </div>
    ),
  },
  ];
}
