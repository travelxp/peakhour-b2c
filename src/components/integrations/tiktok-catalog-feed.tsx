"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TIKTOK_FEED_COPY as COPY, tiktokErrorStatus, tiktokTrackingApi } from "@/lib/tiktok-tracking";

export const TIKTOK_FEED_KEY = ["tiktok-catalog-feed"] as const;

function day(iso: string | null | undefined): string | null {
  return iso ? iso.slice(0, 10) : null;
}

/**
 * "Product feed for TikTok catalog ads" (CAT-G3's routes). The api returns the URL once, on create or rotate, so it is held in
 * this component only and never re-read. If the GET route answers 404 (the api is not deployed yet) the section is not drawn.
 */
export function TikTokCatalogFeed() {
  const queryClient = useQueryClient();
  const feed = useQuery({
    queryKey: TIKTOK_FEED_KEY,
    queryFn: () => tiktokTrackingApi.getFeed(),
    retry: (count, err) => tiktokErrorStatus(err) !== 404 && count < 1,
  });
  const [shownUrl, setShownUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const input = useRef<HTMLInputElement>(null);

  // Quietly absent: not deployed (404) or not readable yet. Nothing here is worth an alarm on the integrations page.
  if (feed.isError) return null;
  if (feed.isLoading || !feed.data) return <Skeleton className="h-16 w-full" />;

  const data = feed.data;

  async function run(action: () => Promise<unknown>, keepUrl: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setCopyState("idle");
    try {
      const res = (await action()) as { url?: string | null } | undefined;
      setShownUrl(keepUrl && res?.url ? res.url : null);
      await queryClient.invalidateQueries({ queryKey: TIKTOK_FEED_KEY });
    } catch {
      setError(COPY.failed);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!shownUrl) return;
    try {
      await navigator.clipboard.writeText(shownUrl);
      setCopyState("copied");
    } catch {
      input.current?.focus();
      input.current?.select();
      setCopyState("failed");
    }
  }

  const stats = [
    typeof data.itemCount === "number" ? `${data.itemCount} products in the feed` : null,
    typeof data.skipped === "number" && data.skipped > 0 ? `${data.skipped} skipped` : null,
    day(data.lastFetchedAt) ? `TikTok last read it on ${day(data.lastFetchedAt)}` : null,
  ].filter(Boolean);

  return (
    <section className="space-y-2 border-t pt-4" data-testid="tiktok-feed" aria-labelledby="tiktok-feed-title">
      <h3 id="tiktok-feed-title" className="text-sm font-medium">
        {COPY.title}
      </h3>
      <p className="text-sm text-muted-foreground">{COPY.intro}</p>

      {!data.enabled ? (
        <>
          <p className="text-sm text-muted-foreground">{COPY.off}</p>
          <Button size="sm" disabled={busy} onClick={() => void run(() => tiktokTrackingApi.createFeed(), true)}>
            {COPY.create}
          </Button>
        </>
      ) : (
        <div className="space-y-2">
          {shownUrl ? (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={input}
                  readOnly
                  value={shownUrl}
                  aria-label="Feed URL"
                  data-testid="tiktok-feed-url"
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 font-mono text-xs"
                />
                <Button size="sm" variant="outline" onClick={() => void copy()}>
                  {copyState === "copied" ? COPY.copied : COPY.copy}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{COPY.shownOnce}</p>
              {copyState === "failed" ? (
                <p role="status" className="text-xs text-muted-foreground">
                  {COPY.copyFallback}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{COPY.hiddenNow}</p>
          )}
          {stats.length > 0 ? <p className="text-xs text-muted-foreground">{stats.join(" · ")}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => tiktokTrackingApi.createFeed(), true)}>
              {COPY.rotate}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => tiktokTrackingApi.disableFeed(), false)}>
              {COPY.turnOff}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{COPY.rotateNote}</p>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
