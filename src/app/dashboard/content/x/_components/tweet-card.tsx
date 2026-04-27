"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/molecules/confirm-dialog";
import {
  Heart,
  MessageCircle,
  Repeat2,
  Quote,
  BarChart3,
  MoreHorizontal,
} from "lucide-react";
import { formatDate } from "@/lib/locale";
import { xApi, type XTweet } from "@/lib/api/x";
import { ApiError } from "@/lib/api";

export function TweetCard({ tweet }: { tweet: XTweet }) {
  const queryClient = useQueryClient();
  const del = useMutation({
    mutationFn: () => xApi.deleteTweet(tweet.id),
    onSuccess: () => {
      toast.success("Tweet deleted.");
      queryClient.invalidateQueries({ queryKey: ["x-tweets"] });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : "Couldn't delete tweet.";
      toast.error(message);
    },
  });

  const m = tweet.publicMetrics;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p className="whitespace-pre-wrap text-sm leading-relaxed flex-1">{tweet.text}</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" aria-label="Tweet actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <ConfirmDialog
                trigger={
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-destructive focus:text-destructive"
                  >
                    Delete tweet
                  </DropdownMenuItem>
                }
                title="Delete this tweet?"
                description="This permanently removes the tweet from x.com. This action cannot be undone."
                confirmLabel="Delete"
                variant="destructive"
                onConfirm={() => del.mutate()}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatDate(tweet.createdAt, null)}</span>
          {m && (
            <div className="flex items-center gap-3">
              <Metric icon={Heart} label="Likes" value={m.likeCount} />
              <Metric icon={MessageCircle} label="Replies" value={m.replyCount} />
              <Metric icon={Repeat2} label="Retweets" value={m.retweetCount} />
              <Metric icon={Quote} label="Quotes" value={m.quoteCount} />
              <Metric icon={BarChart3} label="Impressions" value={m.impressionCount} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <span className="inline-flex items-center gap-1" title={`${label}: ${value}`}>
      <Icon className="size-3.5" />
      <span className="tabular-nums">{compact(value)}</span>
    </span>
  );
}

function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}
