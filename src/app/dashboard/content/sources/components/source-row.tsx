"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  Globe,
  Headphones,
  Loader2,
  Mail,
  MoreHorizontal,
  Pause,
  Play,
  Rss,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  InstagramIcon,
  TwitterIcon,
  YoutubeIcon,
} from "@/components/ui/brand-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApiError } from "@/lib/api";
import { deleteSource, patchSource } from "../api";
import {
  SOURCE_TYPE_LABEL,
  type SourceStatus,
  type SourceType,
  type TrustedSource,
} from "../types";

/**
 * Single source row — visual language adapted from
 * @shadcnblocks/settings-integrations9 (large icon + name on left,
 * meta in the middle, status badge + actions menu on right). Scaled
 * to dashboard density (single row per card, p-4) instead of the
 * block's marketing-page padding.
 *
 * The action set varies by status:
 *   active     → Pause, Delete
 *   suggested  → Accept, Reject
 *   inactive   → Resume, Delete
 *   rejected   → (no actions; rejected is terminal in the UI — ops
 *                can hard-delete via CMS)
 */

/**
 * Mix of lucide icons (most types) and the codebase's hand-rolled
 * brand SVGs (Twitter/Instagram/Youtube — lucide-react doesn't ship
 * trademarked brand marks). Both honor a `className` prop, so the
 * component contract is unified as `(props: { className?: string })
 * => JSX` rather than `LucideIcon`.
 */
type IconComponent = React.ComponentType<{ className?: string }>;

const TYPE_ICON: Record<SourceType, IconComponent> = {
  website: Globe,
  rss: Rss,
  x_handle: TwitterIcon,
  instagram_handle: InstagramIcon,
  youtube_channel: YoutubeIcon,
  newsletter: Mail,
  podcast: Headphones,
  uploaded_doc: Upload,
};

const STATUS_VARIANT: Record<SourceStatus, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  suggested: "secondary",
  inactive: "outline",
  rejected: "destructive",
};

interface SourceRowProps {
  source: TrustedSource;
}

export function SourceRow({ source }: SourceRowProps) {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["trusted-sources"] });
  }

  function handleApiError(err: unknown, fallback: string) {
    if (err instanceof ApiError) toast.error(err.message);
    else toast.error(fallback);
  }

  const pauseMutation = useMutation({
    mutationFn: () => patchSource(source._id, { status: "inactive" }),
    onSuccess: () => {
      toast.success(`${source.displayName} paused`);
      invalidate();
    },
    onError: (e) => handleApiError(e, "Could not pause source"),
  });

  const resumeMutation = useMutation({
    mutationFn: () => patchSource(source._id, { status: "active" }),
    onSuccess: () => {
      toast.success(`${source.displayName} resumed — fetching shortly`);
      invalidate();
    },
    onError: (e) => handleApiError(e, "Could not resume source"),
  });

  const acceptMutation = useMutation({
    mutationFn: () => patchSource(source._id, { status: "active" }),
    onSuccess: () => {
      toast.success(`${source.displayName} added to active sources`);
      invalidate();
    },
    onError: (e) => handleApiError(e, "Could not accept source"),
  });

  const rejectMutation = useMutation({
    // Reason is required by the backend — sending a static value
    // until the UI for capturing a reason ships (a small dialog with
    // a textarea + radio of canned reasons). Until then this rejection
    // path is intentionally rare; the dropdown copy makes that clear.
    mutationFn: () =>
      patchSource(source._id, { status: "rejected", rejectionReason: "Rejected from dashboard" }),
    onSuccess: () => {
      toast.success(`${source.displayName} rejected`);
      invalidate();
    },
    onError: (e) => handleApiError(e, "Could not reject source"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSource(source._id),
    onSuccess: () => {
      toast.success(`${source.displayName} removed`);
      invalidate();
    },
    onError: (e) => handleApiError(e, "Could not remove source"),
  });

  const Icon = TYPE_ICON[source.type] ?? Globe;
  const isPending =
    pauseMutation.isPending ||
    resumeMutation.isPending ||
    acceptMutation.isPending ||
    rejectMutation.isPending ||
    deleteMutation.isPending;

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
      <div
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-md border text-muted-foreground"
      >
        <Icon className="size-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-medium">{source.displayName}</h3>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {SOURCE_TYPE_LABEL[source.type]}
          </Badge>
        </div>
        <p className="truncate font-mono text-xs text-muted-foreground" title={source.identifier}>
          {source.identifier}
        </p>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{source.fetchFrequency}</span>
          <span aria-hidden="true">•</span>
          <span>Trust {(source.trustScore * 100).toFixed(0)}</span>
          {typeof source.usageCount === "number" && source.usageCount > 0 && (
            <>
              <span aria-hidden="true">•</span>
              <span>{source.usageCount} citation{source.usageCount === 1 ? "" : "s"}</span>
            </>
          )}
          <LastFetched source={source} />
        </div>
      </div>

      <Badge variant={STATUS_VARIANT[source.status]} className="shrink-0 capitalize">
        {source.status}
      </Badge>

      <div className="shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" disabled={isPending} aria-label="Source actions">
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MoreHorizontal className="size-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {source.status === "suggested" && (
              <>
                <DropdownMenuItem onClick={() => acceptMutation.mutate()}>
                  <Check className="mr-2 size-4" />
                  Accept
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => rejectMutation.mutate()}>
                  <X className="mr-2 size-4" />
                  Reject
                </DropdownMenuItem>
              </>
            )}
            {source.status === "active" && (
              <DropdownMenuItem onClick={() => pauseMutation.mutate()}>
                <Pause className="mr-2 size-4" />
                Pause
              </DropdownMenuItem>
            )}
            {source.status === "inactive" && (
              <DropdownMenuItem onClick={() => resumeMutation.mutate()}>
                <Play className="mr-2 size-4" />
                Resume
              </DropdownMenuItem>
            )}
            {(source.status === "active" || source.status === "inactive") && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => deleteMutation.mutate()}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-4" />
                  Remove
                </DropdownMenuItem>
              </>
            )}
            {source.status === "rejected" && (
              <DropdownMenuItem disabled>
                Rejected · contact support to restore
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/**
 * Compact "last fetched" string — shows the most informative
 * timestamp available. `lastSuccessfulFetchAt` is the canonical
 * "we got data" signal; `lastFetchedAt` is "we tried." If neither
 * exists yet (source just added, scheduler hasn't ticked), surface
 * the fetch as queued.
 *
 * `Date.now()` is impure, so the time anchor is captured in state
 * via a lazy initializer (React-pure-render rule). A 60-second tick
 * keeps the "5m ago" label moving without forcing a parent re-render
 * — the interval is cheap, and the cleanup unmounts the cycle when
 * the row scrolls off.
 */
function LastFetched({ source }: { source: TrustedSource }) {
  const ts = source.lastSuccessfulFetchAt ?? source.lastFetchedAt;
  // Hooks must be called unconditionally — initialize even when
  // there's no timestamp; the early-return below handles the "no
  // ticks needed" case after the hook calls.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ts) return;
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [ts]);

  if (!ts) {
    return (
      <>
        <span aria-hidden="true">•</span>
        <span>Queued for next fetch</span>
      </>
    );
  }
  const date = new Date(ts);
  const diffMs = now - date.getTime();
  const minutes = Math.round(diffMs / 60_000);
  let label: string;
  if (minutes < 1) label = "just now";
  else if (minutes < 60) label = `${minutes}m ago`;
  else if (minutes < 60 * 24) label = `${Math.round(minutes / 60)}h ago`;
  else if (minutes < 60 * 24 * 7) label = `${Math.round(minutes / (60 * 24))}d ago`;
  else label = date.toLocaleDateString();
  return (
    <>
      <span aria-hidden="true">•</span>
      <span>Fetched {label}</span>
    </>
  );
}
