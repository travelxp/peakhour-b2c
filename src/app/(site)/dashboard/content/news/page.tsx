"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Newspaper, AlertCircle, CalendarPlus } from "lucide-react";
import { CronToolbar } from "@/components/dev/cron-toolbar";
import { api, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SourcesPanel } from "./components/sources-panel";
import { ApproveNewsSheet } from "./components/approve-news-sheet";
import type { NewsIdea } from "./types";

/**
 * /dashboard/content/news — News Desk (N5). The autonomous newsroom's approval
 * queue: corroborated, brand-voice, plagiarism-checked news drafts awaiting a
 * human's go (cnt_ideas source="trending", status="review"), each showing the
 * sources that back it. Each draft can be approved (= scheduled) in one tap via
 * the shared SchedulerComposer, which commits through POST
 * /v1/content/ideas/:id/approve-schedule.
 */
export default function NewsDeskPage() {
  const queryClient = useQueryClient();
  const [approving, setApproving] = useState<NewsIdea | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["news-ideas"],
    queryFn: () => api.get<NewsIdea[]>("/v1/content/ideas?source=trending&status=review&limit=50"),
    retry: false,
    staleTime: 30_000,
  });

  const ideas = data ?? [];

  const invalidateQueue = () =>
    void queryClient.invalidateQueries({ queryKey: ["news-ideas"] });

  return (
    <div className="space-y-6">
      {/* Dev-only (auto-hidden in prod). The News Desk queue is fed by a
          cron pipeline; these buttons run each stage on demand so you don't
          wait for the schedule. Click left-to-right in pipeline order:
          fetch sources → classify → corroborate → compose drafts → run the
          enqueued background jobs. */}
      <CronToolbar
        crons={[
          "source-fetch-scheduler",
          "news-classify",
          "news-corroborate",
          "news-compose",
          "jobs-runner",
        ]}
        onTriggered={invalidateQueue}
      />

      <header>
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Newspaper className="size-6" aria-hidden /> News Desk
        </h2>
        <p className="text-muted-foreground">
          Corroborated, brand-voice news drafts awaiting your go. Each shows the sources that back it — multi-source verified, refactored, never copied.
        </p>
      </header>

      {isError ? (
        <ErrorBlock error={error} />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : ideas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No news drafts in the queue. As your sources are classified and corroborated, the Wire Desk composes drafts here for approval.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {ideas.map((idea) => (
            <NewsCard key={idea._id} idea={idea} onApprove={() => setApproving(idea)} />
          ))}
        </div>
      )}

      <ApproveNewsSheet
        idea={approving}
        open={approving !== null}
        onOpenChange={(next) => {
          if (!next) setApproving(null);
        }}
        onApproved={() => {
          setApproving(null);
          invalidateQueue();
        }}
      />
    </div>
  );
}

function NewsCard({ idea, onApprove }: { idea: NewsIdea; onApprove: () => void }) {
  const preview = idea.content?.plainText ?? idea.description ?? "";
  const confidence = typeof idea.recommendationStrength === "number" ? idea.recommendationStrength : undefined;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <h3 className="font-semibold leading-snug">{idea.content?.subject || idea.title}</h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {idea.channels?.map((ch) => (
            <Badge key={ch} variant="outline" className="text-[10px] uppercase">{ch}</Badge>
          ))}
          {confidence !== undefined && (
            <Badge variant="secondary" className="text-[10px]">Confidence {confidence}%</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {preview && <p className="line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">{preview}</p>}
        <div className="rounded-md border bg-muted/30 p-3">
          <SourcesPanel provenance={idea.sourceProvenance} />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={onApprove} className="gap-1.5">
            <CalendarPlus className="size-3.5" /> Approve &amp; schedule
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ErrorBlock({ error }: { error: unknown }) {
  const message = error instanceof ApiError ? error.message : "Could not load the News Desk queue.";
  return (
    <div className="flex items-start gap-3 py-6">
      <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-destructive" />
      <div className="space-y-1">
        <p className="text-sm font-medium">Couldn&apos;t load the queue</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
