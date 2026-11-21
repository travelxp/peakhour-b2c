"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/providers/auth-provider";
import { formatDate } from "@/lib/locale";
import { driveAbilities } from "@/lib/drive/files-state";
import { TIKTOK_FEED_COPY as COPY, isForbidden, skippedLine, tiktokErrorStatus, tiktokTrackingApi } from "@/lib/tiktok-tracking";

export const TIKTOK_FEED_KEY = ["tiktok-catalog-feed"] as const;

/** The feed read, shared by the feed section and the card (which needs its `connectionStatus`). One request: same key. */
export function useTikTokFeed() {
  return useQuery({
    queryKey: TIKTOK_FEED_KEY,
    queryFn: () => tiktokTrackingApi.getFeed(),
    retry: (count, err) => tiktokErrorStatus(err) !== 404 && count < 1,
  });
}

type Pending = "rotate" | "off" | null;

/**
 * "Product feed for TikTok catalog ads" (CAT-G3's routes). The api returns the URL once, on create or rotate, so it is held in
 * this component only and never re-read. Only a 404 (the route is not deployed) hides the section; any other failed read with no
 * data says so and offers Retry. A failed background refetch keeps the data, and the once-only URL, on screen.
 */
export function TikTokCatalogFeed() {
  const queryClient = useQueryClient();
  const feed = useTikTokFeed();
  const { user, org, orgs } = useAuth();
  const canEdit = driveAbilities(orgs?.find((o) => o._id === org?._id)?.role).canEdit;
  const [shownUrl, setShownUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const input = useRef<HTMLInputElement>(null);

  if (tiktokErrorStatus(feed.error) === 404) return null;
  if (!feed.data) {
    if (feed.isError) {
      return (
        <section className="space-y-2 border-t pt-4" data-testid="tiktok-feed-load-error">
          <p role="alert" className="text-sm text-destructive">
            {COPY.loadFailed}
          </p>
          <Button size="sm" variant="outline" onClick={() => void feed.refetch()}>
            {COPY.retry}
          </Button>
        </section>
      );
    }
    return <Skeleton className="h-16 w-full" />;
  }

  const data = feed.data;

  async function run(action: () => Promise<unknown>, kind: "create" | "rotate" | "off") {
    if (busy) return;
    setBusy(true);
    setError(null);
    setPending(null);
    setCopyState("idle");
    try {
      const res = (await action()) as { url?: string | null } | undefined;
      const wantsUrl = kind !== "off";
      setShownUrl(wantsUrl && res?.url ? res.url : null);
      if (wantsUrl && !res?.url) setError(COPY.noUrl);
      await queryClient.invalidateQueries({ queryKey: TIKTOK_FEED_KEY });
    } catch (err) {
      if (kind === "rotate") {
        // The old link may already be dead: never leave it on screen as if it still worked.
        setShownUrl(null);
        setError(isForbidden(err) ? COPY.askEditor : COPY.rotateFailed);
      } else {
        setError(isForbidden(err) ? COPY.askEditor : COPY.failed);
      }
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
    skippedLine(data.skipped),
    data.lastFetchedAt ? `TikTok last read it on ${formatDate(data.lastFetchedAt, user?.preferences ?? null)}` : null,
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
          {canEdit ? (
            <Button size="sm" disabled={busy} onClick={() => void run(() => tiktokTrackingApi.createFeed(), "create")}>
              {COPY.create}
            </Button>
          ) : null}
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
          {canEdit ? (
            pending ? (
              <div className="space-y-2" data-testid="tiktok-feed-confirm">
                <p role="alert" className="text-sm">
                  {pending === "rotate" ? COPY.rotateConfirm : COPY.turnOffConfirm}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => (pending === "rotate" ? tiktokTrackingApi.createFeed() : tiktokTrackingApi.disableFeed()),
                        pending === "rotate" ? "rotate" : "off",
                      )
                    }
                  >
                    {COPY.confirm}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
                    {COPY.cancel}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setPending("rotate")}>
                  {COPY.rotate}
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPending("off")}>
                  {COPY.turnOff}
                </Button>
              </div>
            )
          ) : null}
        </div>
      )}
      {!canEdit ? <p className="text-sm text-muted-foreground">{COPY.askEditor}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
