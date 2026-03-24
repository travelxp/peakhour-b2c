"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/molecules/data-table";
import {
  SENTIMENT_CONFIG,
  SHELF_LIFE_LABELS,
  label,
} from "@/lib/content-labels";
import { formatDate } from "@/lib/locale";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
    sectors: { name: string; weight: number }[];
    companies: { name: string; role: string; sentiment?: string }[];
    contentType: string;
    sentiment: string;
    shelfLife: string;
    adPotentialScore: number;
    adPotentialAngle?: string;
    topKeywords: string[];
    audienceRelevance: { segment: string; relevance: number }[];
  } | null;
}

export const contentColumns: ColumnDef<Draft, unknown>[] = [
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
    id: "contentType",
    accessorFn: (row) => row.tags?.contentType ?? "",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => {
      const ct = row.original.tags?.contentType;
      return ct ? (
        <Badge variant="outline" className="text-xs">
          {label(undefined, ct)}
        </Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
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
            <Badge key={s.name} variant="secondary" className="text-xs">
              {label(undefined, s.name)}
            </Badge>
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
      if (!config)
        return (
          <Badge variant="outline" className="text-xs">
            {value}
          </Badge>
        );
      return (
        <Badge className={`text-xs ${config.bg} ${config.color} border-0`}>
          {config.label}
        </Badge>
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
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {label(SHELF_LIFE_LABELS, row.original.tags?.shelfLife)}
      </span>
    ),
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
        {formatDate(row.original.publishedAt, null)}
      </span>
    ),
  },
];
