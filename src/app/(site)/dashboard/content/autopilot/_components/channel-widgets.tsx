"use client";

import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ChannelIconCompact } from "@/components/ui/channel-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ChannelWidget } from "@/hooks/use-home-summary";
import { Sparkline } from "@/components/ui/sparkline";

/**
 * Per-channel widgets — one card per CONNECTED channel (the server only
 * returns connected ones, so the grid never bloats with "available"
 * logos the way the old Library page did). Each card is a launchpad:
 * health at a glance, the four pending chips, a 7-day trend, a one-click
 * "add content" (⊕) into that channel's composer, and a click-anywhere
 * jump to the channel workspace.
 */

const HEALTH_DOT: Record<ChannelWidget["health"], string> = {
  healthy: "bg-emerald-500",
  attention: "bg-rose-500",
  disconnected: "bg-muted-foreground/40",
};

const HEALTH_LABEL: Record<ChannelWidget["health"], string> = {
  healthy: "Connected and healthy",
  attention: "Needs reconnecting",
  disconnected: "Disconnected",
};

function Chip({
  count,
  label,
  tone,
}: {
  count: number;
  label: string;
  tone: "amber" | "rose" | "muted";
}) {
  if (count <= 0) return null;
  const tones = {
    amber:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400",
    muted: "bg-muted text-muted-foreground",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tones[tone],
      )}
    >
      <span className="tabular-nums">{count}</span>
      <span className="font-normal">{label}</span>
    </span>
  );
}

function ChannelCard({ channel }: { channel: ChannelWidget }) {
  const { counts } = channel;
  const hasChips =
    counts.needsApproval > 0 ||
    counts.needsAttention > 0 ||
    counts.scheduled > 0 ||
    counts.ideas > 0;

  return (
    <Card className="group relative gap-0 overflow-hidden p-0 transition-shadow hover:shadow-md">
      {/* Click-anywhere overlay to the channel workspace (sits under the
          interactive ⊕ button, which stops propagation via its own link). */}
      <Link
        href={channel.openHref}
        className="absolute inset-0 z-0"
        aria-label={`Open ${channel.name}`}
      />

      <div className="relative z-10 flex items-start justify-between gap-2 p-4 pb-2">
        <div className="flex items-center gap-2">
          <ChannelIconCompact channel={channel.key} size={18} />
          <span className="font-semibold">{channel.name}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "size-2 rounded-full",
                  HEALTH_DOT[channel.health],
                )}
                aria-label={HEALTH_LABEL[channel.health]}
              />
            </TooltipTrigger>
            <TooltipContent>{HEALTH_LABEL[channel.health]}</TooltipContent>
          </Tooltip>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={channel.openHref}
              className="relative z-20 inline-flex size-7 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              aria-label={`Add content for ${channel.name}`}
            >
              <Plus className="size-4" />
            </Link>
          </TooltipTrigger>
          <TooltipContent>Add content</TooltipContent>
        </Tooltip>
      </div>

      <div className="relative z-10 min-h-[2rem] px-4">
        {hasChips ? (
          <div className="flex flex-wrap gap-1.5">
            <Chip count={counts.needsApproval} label="to approve" tone="amber" />
            <Chip count={counts.needsAttention} label="needs attention" tone="rose" />
            <Chip count={counts.scheduled} label="scheduled" tone="muted" />
            <Chip count={counts.ideas} label="ideas" tone="muted" />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/70">
            {channel.health === "attention"
              ? "Reconnect to resume publishing"
              : "Nothing pending — quiet and healthy"}
          </p>
        )}
      </div>

      <div className="relative z-10 mt-3 flex items-end justify-between gap-2 px-4 pb-3">
        <div className="h-7">
          <Sparkline data={channel.spark} />
        </div>
        <span className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
          Open
          <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Card>
  );
}

export function ChannelWidgets({ channels }: { channels: ChannelWidget[] }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
        Channels
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {channels.map((ch) => (
          <ChannelCard key={ch.key} channel={ch} />
        ))}
      </div>
    </div>
  );
}
