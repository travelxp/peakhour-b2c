"use client";

/**
 * Creative review (D-05c) — the business's ad creatives, each with its copy
 * and whether it is approved, and the approve / withdraw actions.
 *
 * ★WHY IT EXISTS: the guardrails card's "Only use creatives I have approved"
 * (D-05b) lets the engine create ads only from creatives a person approved
 * here. Without this screen nothing could be approved, and turning it on
 * stopped every ad the engine would create.
 *
 * ★"APPROVED" IS THE API'S WORD: each creative's state comes from the api,
 * which reads it the way the engine's gate does — an approval counts only
 * while the creative still reads as it did when approved. An edit afterwards
 * reads "Changed since approved".
 *
 * Not under /dashboard/ads: the ads hub is one surface (ads-hub-single-surface);
 * the hub and the guardrails card link here.
 */
import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import { growthApi, type CreativeReviewItem } from "@/lib/api/growth";
import { GUARDRAIL_CHANNELS } from "@/lib/guardrails-copy";
import {
  CREATIVE_FILTERS,
  approvalBadge,
  approvalDetail,
  creativeActionError,
  emptyState,
  filterFor,
  formatLabel,
  platformLabel,
  type BadgeTone,
} from "@/lib/creative-review-copy";

const ALL_PLATFORMS = "__all__";

const TONE_CLASS: Record<BadgeTone, string> = {
  approved: "border-emerald-600/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  changed: "border-amber-600/40 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  pending: "border-border bg-background text-foreground",
  muted: "border-border bg-muted text-muted-foreground",
};

export default function CreativeReviewPage() {
  // useSearchParams needs a Suspense boundary or the route bails out of
  // static rendering.
  return (
    <Suspense fallback={<ListSkeleton />}>
      <CreativeReview />
    </Suspense>
  );
}

function CreativeReview() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filter = filterFor(params.get("filter"));
  const platform = params.get("platform") ?? "";
  const queryClient = useQueryClient();

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const page = useInfiniteQuery({
    queryKey: ["growth-creatives", "list", filter.key, platform],
    queryFn: ({ pageParam }) =>
      growthApi.listCreatives({
        status: filter.statuses,
        ...(platform ? { platform } : {}),
        ...(pageParam ? { before: pageParam } : {}),
      }),
    initialPageParam: "" as string,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Ad creatives</h2>
        <p className="text-muted-foreground">
          The ads Peakhour has written for you. When you turn on &ldquo;Only use creatives I have approved&rdquo; in
          your <Link href="/dashboard/ads" className="underline underline-offset-2">guardrails</Link>, Peakhour
          creates ads only from creatives you approve here &mdash; exactly as they read when you approved them.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter.key} onValueChange={(v) => setParam("filter", v)} activationMode="manual">
          <TabsList>
            {CREATIVE_FILTERS.map((f) => (
              <TabsTrigger key={f.key} value={f.key}>
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Select value={platform || ALL_PLATFORMS} onValueChange={(v) => setParam("platform", v === ALL_PLATFORMS ? null : v)}>
          <SelectTrigger className="w-56" aria-label="Channel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PLATFORMS}>All channels</SelectItem>
            {GUARDRAIL_CHANNELS.map((c) => (
              <SelectItem key={c.key} value={c.key}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ★NO DATA covers a query paused offline too (pending, not loading):
          rendering the empty state then would claim "no creatives" from nothing. */}
      {!page.data ? (
        page.isError ? (
          <Card>
            <CardContent className="space-y-3 p-6">
              <p className="text-sm">We couldn&rsquo;t load your creatives.</p>
              <Button variant="outline" size="sm" onClick={() => page.refetch()}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ListSkeleton />
        )
      ) : (
        <CreativeList
          items={page.data.pages.flatMap((p) => p.creatives)}
          summary={page.data.pages[0]!.summary}
          filterKey={filter.key}
          onChanged={() => queryClient.invalidateQueries({ queryKey: ["growth-creatives"] })}
          more={
            page.hasNextPage ? (
              <Button variant="outline" onClick={() => page.fetchNextPage()} disabled={page.isFetchingNextPage}>
                {page.isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Show more
              </Button>
            ) : null
          }
        />
      )}
    </div>
  );
}

function CreativeList({
  items,
  summary,
  filterKey,
  onChanged,
  more,
}: {
  items: CreativeReviewItem[];
  summary: Parameters<typeof emptyState>[0];
  filterKey: Parameters<typeof emptyState>[1];
  onChanged: () => void;
  more: React.ReactNode;
}) {
  if (items.length === 0) {
    const e = emptyState(summary, filterKey);
    return (
      <Card>
        <CardContent className="space-y-2 p-6">
          <h3 className="font-medium">{e.title}</h3>
          <p className="text-sm text-muted-foreground">{e.body}</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <CreativeCard key={item.id} item={item} onChanged={onChanged} />
      ))}
      {more}
    </div>
  );
}

function formatDay(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function CreativeCard({ item, onChanged }: { item: CreativeReviewItem; onChanged: () => void }) {
  const [pending, setPending] = useState<"approve" | "withdraw" | null>(null);
  const act = useMutation({
    mutationFn: (action: "approve" | "withdraw"): Promise<{ status: string }> =>
      action === "approve" ? growthApi.approveCreative(item.id) : growthApi.withdrawCreativeApproval(item.id),
    onMutate: (action) => setPending(action),
    onSuccess: (_res, action) => {
      toast.success(action === "approve" ? "Creative approved." : "Approval taken back.");
      onChanged();
    },
    onError: (err, action) => {
      toast.error(creativeActionError(err instanceof ApiError ? err : null, action));
      // A refusal means the creative is not what this card shows: reload it.
      if (err instanceof ApiError) onChanged();
    },
    onSettled: () => setPending(null),
  });
  const badge = approvalBadge(item);
  const fmt = formatLabel(item.format);

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={TONE_CLASS[badge.tone]}>
            {badge.label}
          </Badge>
          <span className="text-sm font-medium">{platformLabel(item.platform)}</span>
          {fmt && <span className="text-sm text-muted-foreground">· {fmt}</span>}
          {item.angle && <span className="text-sm text-muted-foreground">· {item.angle.replace(/_/g, " ")}</span>}
        </div>

        <p className="text-sm text-muted-foreground">{approvalDetail(item, formatDay(item.approval?.at ?? null))}</p>

        <dl className="space-y-3 text-sm">
          <Lines label="Headlines" lines={item.headlines} />
          <Lines label="Body" lines={item.bodyTexts} />
          <Lines label="Descriptions" lines={item.descriptions} />
          <Lines label="Button" lines={item.ctas} />
          {item.landingUrl && (
            <div>
              <dt className="font-medium">Landing page</dt>
              <dd>
                <a href={item.landingUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 break-all underline underline-offset-2">
                  {item.landingUrl}
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                </a>
              </dd>
            </div>
          )}
          {item.imageBriefs.length > 0 && (
            <div>
              <dt className="font-medium">Images</dt>
              <dd className="flex flex-wrap gap-3">
                {item.imageBriefs.map((b, i) =>
                  b.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={b.imageUrl} alt={b.prompt ?? "Ad image"} className="h-32 w-32 rounded-md border object-cover" />
                  ) : (
                    <p key={i} className="text-muted-foreground">
                      Not made yet: {b.prompt ?? "an image"}
                    </p>
                  ),
                )}
              </dd>
            </div>
          )}
          {item.videoUrl && (
            <div>
              <dt className="font-medium">Video</dt>
              <dd>
                <a href={item.videoUrl} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2">
                  Watch the video
                </a>
              </dd>
            </div>
          )}
        </dl>

        {item.preflight && item.preflight.decision !== "allow" && item.preflight.summary && (
          <p
            className={
              item.preflight.decision === "block"
                ? "rounded-md border border-destructive/40 p-3 text-sm"
                : "rounded-md border border-amber-600/40 p-3 text-sm"
            }
          >
            <span className="font-medium">Ad-policy check: </span>
            {item.preflight.summary}
          </p>
        )}
        {item.retiredReason && item.status === "retired" && !item.preflight?.summary && (
          <p className="text-sm text-muted-foreground">Retired: {item.retiredReason}</p>
        )}
        {item.rationale && <p className="text-sm text-muted-foreground">Why this ad: {item.rationale}</p>}

        {(item.canApprove || item.canWithdraw) && (
          <div className="flex flex-wrap gap-2">
            {item.canApprove && (
              <Button size="sm" onClick={() => act.mutate("approve")} disabled={act.isPending}>
                {pending === "approve" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {item.approvalState === "changed_since_approved" ? "Approve as it reads now" : "Approve"}
              </Button>
            )}
            {item.canWithdraw && (
              <Button size="sm" variant="outline" onClick={() => act.mutate("withdraw")} disabled={act.isPending}>
                {pending === "withdraw" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Take approval back
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Lines({ label, lines }: { label: string; lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <div>
      <dt className="font-medium">{label}</dt>
      {lines.map((l, i) => (
        <dd key={i} className="whitespace-pre-wrap">
          {l}
        </dd>
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-80" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
