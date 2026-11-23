"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useLocale } from "@/hooks/use-locale";
import type { ScheduledItemDto } from "@/lib/scheduler/types";
import { isVideoPayload, tiktokStatusView, type TikTokStatusView } from "@/lib/tiktok-content-view";

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
  /** Ids whose Post button was pressed in this browser (they read "Waiting for TikTok approval"). */
  requested: ReadonlySet<string>;
  /** Present on the channel page only: opens the post sheet for an approved item. */
  onPost?: (item: ScheduledItemDto) => void;
}

/** TikTok items with their real state. The channel page and Results share it, so a post reads the same on both. */
export function TikTokStatusList({ items, requested, onPost }: TikTokStatusListProps) {
  const { formatDate } = useLocale();
  return (
    <ul className="space-y-3" aria-label="TikTok posts">
      {items.map((item) => {
        const view = tiktokStatusView(item, requested.has(item._id));
        const video = isVideoPayload(item.payload.mediaUrls);
        const canPost = view.status === "approved" && onPost;
        return (
          <li key={item._id}>
            <Card>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm font-medium">{item.payload.text || "TikTok post with no caption"}</p>
                  <p className="text-xs text-muted-foreground">
                    {video ? "Video" : "Photos"} · Made {formatDate(new Date(item.createdAt), { dateStyle: "medium" })}
                  </p>
                  <p className="text-xs text-muted-foreground">{view.detail}</p>
                </div>
                <TikTokStatusChip view={view} />
                {canPost ? (
                  <Button type="button" size="sm" onClick={() => onPost(item)}>
                    Post to TikTok
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
