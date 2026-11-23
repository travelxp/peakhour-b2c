"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useLocale } from "@/hooks/use-locale";
import type { ScheduledItemDto } from "@/lib/scheduler/types";
import { isVideoItem, tiktokStatusView, type TikTokStatusView } from "@/lib/tiktok-content-view";

const TONE: Record<TikTokStatusView["tone"], string> = {
  neutral: "border-border text-muted-foreground",
  info: "border-border bg-muted text-foreground",
  success: "border-success/40 bg-success/10 text-success-on-tint",
  warning: "border-warning/40 bg-warning/10 text-warning-on-tint",
  destructive: "border-destructive/40 bg-destructive/5 text-destructive",
};

export function TikTokStatusChip({ view }: { view: TikTokStatusView }) {
  return (
    <Badge variant="outline" className={TONE[view.tone]} data-testid="tiktok-status">
      {view.label}
    </Badge>
  );
}

export interface TikTokStatusListProps {
  items: ScheduledItemDto[];
  /** Present on the channel page only: opens the post sheet for an item that offers Post or Open. */
  onPost?: (item: ScheduledItemDto) => void;
  /** The item a link pointed at: scrolled into view and outlined. */
  highlightId?: string | null;
}

/** TikTok items with their real state. The channel page and Results share it, so a post reads the same on both. */
export function TikTokStatusList({ items, onPost, highlightId = null }: TikTokStatusListProps) {
  const { formatDate } = useLocale();
  const scrolledTo = useRef<string | null>(null);
  // A link to a post brings it into view, once per link (a second link scrolls again).
  useEffect(() => {
    if (!highlightId) {
      scrolledTo.current = null;
      return;
    }
    if (scrolledTo.current === highlightId) return;
    const el = document.getElementById(`tiktok-item-${highlightId}`);
    if (el) {
      scrolledTo.current = highlightId;
      el.scrollIntoView?.({ block: "center", behavior: "smooth" });
    }
  }, [highlightId, items]);
  return (
    <ul className="space-y-3" aria-label="TikTok posts">
      {items.map((item) => {
        const view = tiktokStatusView(item);
        const video = isVideoItem(item);
        const canAct = view.action !== null && onPost;
        return (
          <li key={item._id} id={`tiktok-item-${item._id}`} data-highlighted={highlightId === item._id ? "true" : undefined}>
            <Card className={highlightId === item._id ? "ring-2 ring-primary" : undefined}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm font-medium">{item.payload.text || "TikTok post with no caption"}</p>
                  <p className="text-xs text-muted-foreground">
                    {video ? "Video" : "Photos"} · Made {formatDate(new Date(item.createdAt), { dateStyle: "medium" })}
                  </p>
                  <p className="text-xs text-muted-foreground">{view.detail}</p>
                </div>
                <TikTokStatusChip view={view} />
                {canAct ? (
                  <Button type="button" size="sm" onClick={() => onPost(item)}>
                    {view.action === "open" ? "Open" : view.action === "edit" ? "Edit" : "Post to TikTok"}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
