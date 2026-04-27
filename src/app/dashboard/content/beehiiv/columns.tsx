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
            value={value}
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

export function getContentColumns(prefs: UserPreferences | null): ColumnDef<Draft, unknown>[] {
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
      if (score == null)
        return <span className="text-xs text-muted-foreground">Not scored</span>;
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
  ];
}
