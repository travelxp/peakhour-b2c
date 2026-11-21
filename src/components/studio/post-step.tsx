"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SchedulerComposer } from "@/components/scheduler/scheduler-composer";
import { FLOW_KEYS } from "@/hooks/use-studio-flow";
import { studioApi, type AdHandoff, type OrganicHandoff } from "@/lib/api/creative-studio";
import { scheduler } from "@/lib/scheduler/client";
import { detectTimezone } from "@/lib/scheduler/format";
import { sourceTextHash } from "@/lib/scheduler/source-hash";
import { STUDIO_ROUTES } from "@/lib/studio";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { adPlatformLabel, captionLength, captionProblem, channelByKey, channelLabel, mediaFor } from "@/lib/studio-publish";
import { cn } from "@/lib/utils";

const P = STUDIO_COPY.post;

export interface PostVersion {
  id: string;
  channel: string;
  label: string;
  width: number;
  height: number;
}

export type PostWhen = "now" | "later";

export interface PostStepViewProps {
  status: "loading" | "error" | "ready";
  versions: PostVersion[];
  media: Array<{ versionId: string; url: string }>;
  channels: string[];
  captions: Record<string, string>;
  onCaption: (channel: string, text: string) => void;
  when: PostWhen;
  onWhen: (w: PostWhen) => void;
  /** The scheduler's own time picker, shown for "Pick a time" once every caption is fine. */
  schedule: React.ReactNode;
  posting: boolean;
  failure?: string;
  onPostNow: () => void;
  onRetry: () => void;
  onBack: () => void;
  onUseInAd: () => void;
  adPending: boolean;
  adNote?: { text: string; growthHref: string };
  adError?: string;
  onSaveForLater: () => void;
  done?: { text: string };
  disclosure: string;
}

/**
 * Step two of the sheet (UX spec S13): the caption for each channel, when, and the one act that is the approval to publish. Nothing goes out
 * until Post it or Schedule it is pressed. "Use in an ad" hands the picture to the Ad Engine as a review row; it never spends ad budget.
 */
export function PostStepView(p: PostStepViewProps) {
  if (p.status === "loading") {
    return (
      <div aria-busy="true" aria-label={P.preparing} className="space-y-2">
        <p role="status" className="text-sm text-muted-foreground">
          {P.preparing}
        </p>
        <Skeleton className="h-32 rounded-lg" />
      </div>
    );
  }
  if (p.status === "error") {
    return (
      <div role="alert" className="space-y-2 rounded-lg border p-3 text-sm">
        <p>{P.prepareFailed}</p>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" className="h-11" onClick={p.onRetry}>
            {STUDIO_COPY.refusal.tryAgain}
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-11" onClick={p.onBack}>
            {P.back}
          </Button>
        </div>
      </div>
    );
  }
  if (p.done) {
    return (
      <div className="space-y-3" data-slot="studio-post-done">
        <p role="status" className="text-base font-semibold">
          {p.done.text}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="h-12">
            <Link href="/dashboard/calendar">{P.seeCalendar}</Link>
          </Button>
          <Button asChild variant="outline" className="h-12">
            <Link href={STUDIO_ROUTES.home}>{P.makeAnother}</Link>
          </Button>
        </div>
      </div>
    );
  }
  const problems = p.channels.map((c) => captionProblem(p.captions[c] ?? "", c));
  // A post that was approved as a picture post never goes out as words alone: a channel with no picture holds the whole step.
  const noPicture = p.channels.filter((c) => mediaFor(c, p.versions, p.media).length === 0);
  const anyProblem = problems.some(Boolean) || noPicture.length > 0;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto" data-slot="studio-post-step">
      {p.channels.map((c, i) => {
        const label = channelLabel(c);
        const text = p.captions[c] ?? "";
        const max = channelByKey(c)?.captionMax;
        const mine = p.versions.filter((v) => v.channel === c);
        const problem = problems[i];
        const id = `studio-caption-${c}`;
        return (
          <fieldset key={c} className="space-y-2 rounded-lg border p-3">
            <legend className="px-1 text-sm font-semibold">{label}</legend>
            <p className="text-xs text-muted-foreground">{mine.map((v) => `${v.label} ${v.width} × ${v.height}`).join(", ")}</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {mine.map((v) => {
                const url = p.media.find((m) => m.versionId === v.id)?.url;
                return url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- merchant media stays off the optimiser (see MediaImage)
                  <img key={v.id} src={url} alt={`${label} ${v.label}`} width={72} height={72} className="h-20 w-auto rounded-md border" style={{ aspectRatio: `${v.width} / ${v.height}` }} />
                ) : null;
              })}
            </div>
            <Label htmlFor={id} className="text-sm">
              {P.captionFor(label)}
            </Label>
            <Textarea
              id={id}
              value={text}
              rows={4}
              aria-invalid={problem === "too_long"}
              aria-describedby={`${id}-count`}
              onChange={(e) => p.onCaption(c, e.target.value)}
            />
            <p id={`${id}-count`} className={cn("text-xs", problem ? "text-destructive" : "text-muted-foreground")} aria-live="polite">
              {max !== undefined ? P.captionCount(captionLength(text), max) : null}
              {problem === "too_long" && max !== undefined && ` ${P.captionTooLong(label, max)}`}
              {problem === "required" && ` ${P.captionRequired}`}
            </p>
          </fieldset>
        );
      })}

      {noPicture.length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {noPicture.map((c) => P.noPicture(channelLabel(c))).join(" ")}
        </p>
      )}

      <p className="text-xs text-muted-foreground">{p.disclosure}</p>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{P.when}</legend>
        <div role="radiogroup" aria-label={P.when} className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(["now", "later"] as const).map((w) => (
            <button
              key={w}
              type="button"
              role="radio"
              aria-checked={p.when === w}
              onClick={() => p.onWhen(w)}
              className={cn(
                "h-11 rounded-md px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                p.when === w ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
            >
              {w === "now" ? P.now : P.later}
            </button>
          ))}
        </div>
      </fieldset>

      {p.failure && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {p.failure}{" "}
          <Link href="/dashboard/calendar" className="font-medium underline underline-offset-2">
            {P.seeCalendar}
          </Link>
        </p>
      )}

      {p.when === "now" ? (
        <Button type="button" className="h-12" disabled={anyProblem || p.posting} aria-busy={p.posting} onClick={p.onPostNow}>
          {p.posting ? P.posting : P.postIt}
        </Button>
      ) : anyProblem ? (
        <p className="text-sm text-muted-foreground">{P.captionRequired}</p>
      ) : (
        p.schedule
      )}

      <div className="space-y-2 border-t pt-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-11" disabled={p.adPending} onClick={p.onUseInAd}>
            {P.useInAd}
          </Button>
          <Button type="button" variant="ghost" className="h-11" onClick={p.onSaveForLater}>
            {P.saveForLater}
          </Button>
          <Button type="button" variant="ghost" className="h-11" onClick={p.onBack}>
            {P.back}
          </Button>
        </div>
        {p.adNote && (
          <div role="status" className="space-y-2 text-sm">
            <p>{p.adNote.text}</p>
            <Button asChild size="sm" variant="outline" className="h-11">
              <Link href={p.adNote.growthHref}>{P.openGrowth}</Link>
            </Button>
          </div>
        )}
        {p.adError && (
          <p role="alert" className="text-sm text-destructive">
            {p.adError}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{P.adBudget}</p>
      </div>
    </div>
  );
}

const apiMessage = (e: unknown, fallback: string): string => (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.message ? e.message : fallback);

/**
 * The post step, wired: saves the chosen sizes as published files (free, repeatable; `handoff`), then Post it goes through the existing
 * scheduler (commit a plan for now and publish it, exactly as the Meta composer does) and Pick a time shows the scheduler's own composer. The
 * sizes are marked posted or scheduled on the creative once the scheduler has taken them.
 */
export function PostStep({
  creativeId,
  versions,
  headlineFallback,
  onBack,
  onClose,
}: {
  creativeId: string;
  versions: PostVersion[];
  headlineFallback: string;
  onBack: () => void;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const ids = useMemo(() => versions.map((v) => v.id).sort(), [versions]);
  const channels = useMemo(() => [...new Set(versions.map((v) => v.channel))], [versions]);
  const handoff = useQuery<OrganicHandoff>({
    queryKey: ["studio-handoff", creativeId, ids.join(",")],
    queryFn: () => studioApi.handoffOrganic(creativeId, ids),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [when, setWhen] = useState<PostWhen>("now");
  const [done, setDone] = useState<{ text: string } | undefined>();
  const [failure, setFailure] = useState<string | undefined>();
  const [adNote, setAdNote] = useState<{ text: string; growthHref: string } | undefined>();
  const [adError, setAdError] = useState<string | undefined>();
  // One plan per press of Post it: a retry after a failed send re-sends the plan that exists instead of committing a second one.
  const planRef = useRef<{ planId: string; hash: string } | null>(null);
  // Channels that already took the post: a retry after a partial failure sends only the ones that did not, and a plan committed
  // again after an edit leaves them out (the scheduler sends a due item on its own, so a skipped item would still post twice).
  const postedRef = useRef<Set<string>>(new Set());

  const captions = useMemo(() => {
    const base = handoff.data?.caption.text || headlineFallback;
    return Object.fromEntries(channels.map((c) => [c, edited[c] ?? base]));
  }, [channels, edited, handoff.data, headlineFallback]);
  const media = useMemo(() => handoff.data?.media ?? [], [handoff.data]);
  const entries = useMemo(
    () => channels.map((c) => ({ channel: c, payload: { text: (captions[c] ?? "").trim(), mediaUrls: mediaFor(c, versions, media) } })),
    [channels, captions, versions, media],
  );
  const source = useMemo(
    () => ({ sourceType: "ad_hoc" as const, sourceTextHash: sourceTextHash(`${creativeId}|${ids.join(",")}|${entries.map((e) => `${e.channel}:${e.payload.text}`).join("|")}`) }),
    [creativeId, ids, entries],
  );
  const title = (handoff.data?.caption.headline || headlineFallback || STUDIO_COPY.shortlist.untitled).slice(0, 120);

  const confirm = (verIds: string[], state: "scheduled" | "published") =>
    studioApi
      .confirmHandoff(creativeId, verIds, state)
      .catch(() => undefined)
      .finally(() => void qc.invalidateQueries({ queryKey: [FLOW_KEYS.creative] }));

  const postNow = useMutation({
    mutationFn: async () => {
      const alreadyPosted = channels.filter((c) => postedRef.current.has(c)).map((c) => ({ channel: c, published: true }));
      if (alreadyPosted.length === channels.length) return alreadyPosted;
      let planId = planRef.current && planRef.current.hash === source.sourceTextHash ? planRef.current.planId : undefined;
      if (!planId) {
        // The words changed since the last press: the plan that was committed for the old words must not go out later as a duplicate.
        if (planRef.current) await scheduler.cancelPlan(planRef.current.planId).catch(() => undefined);
        const plan = await scheduler.commitPlan({
          title,
          source,
          channels: entries.filter((e) => !postedRef.current.has(e.channel)),
          staggerStrategy: "synchronized",
          canonicalScheduledAtUtc: new Date().toISOString(),
          timezone: detectTimezone(),
        });
        planId = plan.planId;
        planRef.current = { planId, hash: source.sourceTextHash };
      }
      const { items } = await scheduler.listItems({ planId, limit: 20 });
      const results: Array<{ channel: string; published: boolean }> = alreadyPosted;
      for (const it of items) {
        if (postedRef.current.has(it.channel)) continue;
        if (it.status === "published") {
          postedRef.current.add(it.channel);
          results.push({ channel: it.channel, published: true });
          continue;
        }
        try {
          const r = await scheduler.publishItemNow(it._id);
          if (r.published) postedRef.current.add(it.channel);
          results.push({ channel: it.channel, published: r.published });
        } catch {
          results.push({ channel: it.channel, published: false });
        }
      }
      return results;
    },
    onSuccess: async (results) => {
      void qc.invalidateQueries({ queryKey: ["scheduler:items"] });
      const ok = new Set(results.filter((r) => r.published).map((r) => r.channel));
      const verIds = versions.filter((v) => ok.has(v.channel)).map((v) => v.id);
      if (verIds.length > 0) await confirm(verIds, "published");
      const failed = results.filter((r) => !r.published).map((r) => channelLabel(r.channel));
      if (failed.length === 0 && results.length > 0) {
        setFailure(undefined);
        setDone({ text: P.posted });
      } else {
        setFailure(failed.length > 0 ? failed.map((n) => P.notPosted(n)).join(" ") : P.schedulerRefused);
      }
    },
    onError: (e) => setFailure(apiMessage(e, P.schedulerRefused)),
  });

  const useInAd = useMutation({
    mutationFn: () => studioApi.handoffAd(creativeId, ids),
    onSuccess: (r: AdHandoff) => {
      setAdError(undefined);
      const names = r.adCreatives.length > 1 ? r.adCreatives.map((a) => adPlatformLabel(a.platform)).join(", ") : "";
      setAdNote({ text: r.adCreatives.length > 1 ? P.adAddedFor(names) : P.adAdded, growthHref: "/dashboard/ads" });
    },
    onError: (e) => setAdError(apiMessage(e, STUDIO_COPY.refusal.wentWrong)),
  });

  const schedule = (
    <SchedulerComposer
      key={ids.join(",")}
      source={source}
      title={title}
      channels={entries}
      submitLabel={P.scheduleIt}
      hideListingOption
      onScheduled={(r) => {
        void confirm(ids, "scheduled");
        const at = r.resolvedTimes[0]?.scheduledAtUtc;
        setDone({ text: P.scheduled(at ? new Date(at).toLocaleString() : "") });
      }}
    />
  );

  return (
    <PostStepView
      status={handoff.isError ? "error" : handoff.data ? "ready" : "loading"}
      versions={versions}
      media={media}
      channels={channels}
      captions={captions}
      onCaption={(c, t) => {
        setEdited((e) => ({ ...e, [c]: t }));
        setFailure(undefined);
      }}
      when={when}
      onWhen={setWhen}
      schedule={schedule}
      posting={postNow.isPending}
      failure={failure}
      onPostNow={() => {
        setFailure(undefined);
        postNow.mutate();
      }}
      onRetry={() => void handoff.refetch()}
      onBack={onBack}
      onUseInAd={() => useInAd.mutate()}
      adPending={useInAd.isPending}
      adNote={adNote}
      adError={adError}
      onSaveForLater={() => {
        toast.success(P.saved);
        onClose();
      }}
      done={done}
      disclosure={handoff.data?.disclosure ?? P.disclosure}
    />
  );
}
