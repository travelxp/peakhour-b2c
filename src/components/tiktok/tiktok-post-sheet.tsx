"use client";

import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api";
import { tiktokContentApi, type TikTokCreatorInfo } from "@/lib/api/tiktok-content";
import { reconnectHref } from "@/lib/integrations-connect";
import { scheduler } from "@/lib/scheduler/client";
import { TIKTOK_ITEMS_KEY } from "@/hooks/use-tiktok-content";
import type { ScheduledItemDto } from "@/lib/scheduler/types";
import {
  TIKTOK_COMING_SOON_MESSAGE,
  TIKTOK_PATH,
  TIKTOK_PROVIDER,
  commercialLabel,
  isVideoItem,
  type VideoLength,
  postProblems,
  privacyDisabled,
  privacyLabel,
  SELF_ONLY,
  tiktokAccountState,
} from "@/lib/tiktok-content-view";

/** TikTok's own pages for the two declarations. */
export const MUSIC_USAGE_URL = "https://www.tiktok.com/legal/page/global/music-usage-confirmation/en";
export const BRANDED_CONTENT_POLICY_URL = "https://www.tiktok.com/legal/page/global/bc-policy/en";

export interface TikTokPostSheetProps {
  /** The approved item to post. Null closes the sheet. */
  item: ScheduledItemDto | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * The TikTok post sheet: the last step before a post, built to TikTok's Content Posting requirements (the account, the preview, who can see it,
 * comments, Duet and Stitch, commercial content, the declaration, the length limit).
 *
 * POST SAVES THE CHOICES AND SENDS NOTHING TO TIKTOK. TikTok has not approved Peakhour to publish, so Post stores the choices on the item and
 * schedules it for now; the api parks it as "waiting for TikTok approval" without calling TikTok. The sheet then says so. It never calls
 * publish-now and nothing on screen says the post is live.
 */
export function TikTokPostSheet({ item, onOpenChange }: TikTokPostSheetProps) {
  return (
    <Sheet open={item !== null} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="text-base">Post to TikTok</SheetTitle>
          <SheetDescription className="text-xs">Check how this post will look and choose who can see it.</SheetDescription>
        </SheetHeader>
        {item ? <SheetBody key={item._id} item={item} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function SheetBody({ item }: { item: ScheduledItemDto }) {
  const creator = useQuery({
    queryKey: ["tiktok", "creator-info"],
    queryFn: () => tiktokContentApi.creatorInfo(),
    staleTime: 60_000,
    retry: false,
  });

  if (creator.isLoading) {
    return (
      <div className="space-y-3 p-6" aria-busy="true">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (creator.isError || !creator.data) {
    const err = creator.error;
    const state = tiktokAccountState(err instanceof ApiError ? err : err ? {} : null);
    if (state === "not_connected" || state === "needs_reauth") {
      return (
        <div className="space-y-3 p-6" role="alert">
          <p className="text-sm font-medium">{state === "not_connected" ? "Connect TikTok to post" : "TikTok needs a quick reconnect"}</p>
          <p className="text-sm text-muted-foreground">
            {state === "not_connected"
              ? "Peakhour needs your TikTok account to show who will post."
              : "Your TikTok connection has expired. Reconnect to continue."}
          </p>
          <Button asChild size="sm">
            <a href={reconnectHref(TIKTOK_PATH, TIKTOK_PROVIDER)}>Reconnect TikTok</a>
          </Button>
        </div>
      );
    }
    return (
      <div className="space-y-3 p-6" role="alert">
        <p className="text-sm font-medium">We could not reach TikTok</p>
        <p className="text-sm text-muted-foreground">Something went wrong on our side or theirs. Try again in a moment.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void creator.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  return <PostForm item={item} creator={creator.data} />;
}

function PostForm({ item, creator }: { item: ScheduledItemDto; creator: TikTokCreatorInfo }) {
  const id = useId();
  const media = item.payload.mediaUrls ?? [];
  const video = isVideoItem(item);
  const queryClient = useQueryClient();

  // No privacy level is chosen for the merchant: the audience of a post is theirs to decide.
  const [privacy, setPrivacy] = useState<string | null>(null);
  const [comments, setComments] = useState(false);
  const [duet, setDuet] = useState(false);
  const [stitch, setStitch] = useState(false);
  const [commercial, setCommercial] = useState(false);
  const [yourBrand, setYourBrand] = useState(false);
  const [brandedContent, setBrandedContent] = useState(false);
  // A video's length is read from the file itself: Post stays off until it is known, and an unreadable file says so.
  const [length, setLength] = useState<VideoLength>({ state: "checking" });
  const [answered, setAnswered] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const choices = { privacy, commercial, yourBrand, brandedContent };
  const problems = postProblems(choices, video ? { kind: "video", length } : { kind: "photos" }, creator.maxVideoPostDurationSec);
  const label = commercialLabel(choices);

  // Post saves the choices on the item and schedules it for now. The api parks it (needs_action, tiktok_coming_soon) without calling TikTok.
  const save = useMutation({
    mutationFn: async () => {
      await scheduler.editItemPayload(item._id, {
        channelOptions: {
          privacyLevel: privacy,
          allowComment: comments && !creator.commentDisabled,
          allowDuet: video && duet && !creator.duetDisabled,
          allowStitch: video && stitch && !creator.stitchDisabled,
          brandOrganicToggle: commercial && yourBrand,
          brandContentToggle: commercial && brandedContent,
        },
      });
      await scheduler.rescheduleItem(item._id, { scheduledAtUtc: new Date(), mode: "item" });
    },
    onSuccess: () => {
      setFailure(null);
      setAnswered(true);
      void queryClient.invalidateQueries({ queryKey: TIKTOK_ITEMS_KEY });
    },
    onError: (err: unknown) => {
      setAnswered(false);
      const raw = err instanceof Error ? err.message : "";
      setFailure(raw && raw !== "Invalid request body" ? raw : "We could not save your choices. Try again.");
    },
  });

  const options = creator.privacyLevelOptions;
  const nickname = creator.nickname ?? "your TikTok account";

  return (
    <div className="flex-1 space-y-6 px-6 py-5">
      <section aria-label="Posting as" className="flex items-center gap-3 rounded-md border bg-muted/30 p-3" data-testid="tiktok-creator">
        {creator.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- TikTok CDN avatar, signed URL
          <img src={creator.avatarUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold" aria-hidden>
            {nickname.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Posting as</p>
          <p className="truncate text-sm font-medium">{creator.nickname ?? "Your TikTok account"}</p>
        </div>
      </section>

      <section aria-label="Preview" className="space-y-2" data-testid="tiktok-preview">
        <h3 className="text-sm font-semibold">Preview</h3>
        {media.length === 0 ? (
          <p className="text-sm text-muted-foreground">This post has no video or photos yet.</p>
        ) : video ? (
          <video
            src={media[0]}
            controls
            preload="metadata"
            className="max-h-72 w-full rounded-md border bg-black"
            aria-label="Video preview"
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration;
              setLength(Number.isFinite(d) && d > 0 ? { state: "known", seconds: d } : { state: "unreadable" });
            }}
            onError={() => setLength({ state: "unreadable" })}
          />
        ) : (
          <ul className="flex flex-wrap gap-2" aria-label="Photos in this post">
            {media.map((src, i) => (
              <li key={`${src}-${i}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- merchant's own media link */}
                <img src={src} alt={`Photo ${i + 1} of ${media.length}`} className="size-24 rounded-md border object-cover" />
              </li>
            ))}
          </ul>
        )}
        <p className="whitespace-pre-wrap rounded-md border p-3 text-sm" data-testid="tiktok-caption">
          {item.payload.text || "No caption"}
        </p>
        {label ? (
          <p className="text-xs font-medium" data-testid="tiktok-label-preview">
            Your post will be labelled &ldquo;{label}&rdquo;.
          </p>
        ) : null}
      </section>

      <div className="space-y-2">
        <Label htmlFor={`${id}-privacy`} className="text-sm font-semibold">
          Who can see this post
        </Label>
        <select
          id={`${id}-privacy`}
          value={privacy ?? ""}
          onChange={(e) => setPrivacy(e.target.value || null)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          aria-describedby={`${id}-privacy-help`}
        >
          <option value="" disabled>
            Choose who can see this post
          </option>
          {options.map((o) => (
            <option key={o} value={o} disabled={privacyDisabled(o, { commercial, brandedContent })}>
              {privacyLabel(o)}
            </option>
          ))}
        </select>
        <p id={`${id}-privacy-help`} className="text-xs text-muted-foreground">
          {commercial && brandedContent
            ? "“Only me” is not available for branded content, because a paid partnership cannot be private."
            : "You choose this each time. Peakhour never picks it for you."}
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">What people can do</legend>
        <SwitchRow
          id={`${id}-comments`}
          label="Allow comments"
          checked={comments}
          onChange={setComments}
          disabled={creator.commentDisabled}
          note={creator.commentDisabled ? "Comments are turned off in your TikTok account settings, so they cannot be allowed here." : undefined}
        />
        {video ? (
          <>
            <SwitchRow
              id={`${id}-duet`}
              label="Allow Duet"
              checked={duet}
              onChange={setDuet}
              disabled={creator.duetDisabled}
              note={creator.duetDisabled ? "Duet is turned off in your TikTok account settings, so it cannot be allowed here." : undefined}
            />
            <SwitchRow
              id={`${id}-stitch`}
              label="Allow Stitch"
              checked={stitch}
              onChange={setStitch}
              disabled={creator.stitchDisabled}
              note={creator.stitchDisabled ? "Stitch is turned off in your TikTok account settings, so it cannot be allowed here." : undefined}
            />
          </>
        ) : null}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Commercial content</legend>
        <SwitchRow
          id={`${id}-commercial`}
          label="Disclose commercial content"
          checked={commercial}
          onChange={(v) => {
            setCommercial(v);
            if (!v) {
              setYourBrand(false);
              setBrandedContent(false);
            }
          }}
          note="Turn this on if the post promotes your own business or another brand."
        />
        {commercial ? (
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-start gap-2">
              <Checkbox id={`${id}-your-brand`} checked={yourBrand} onCheckedChange={(v) => setYourBrand(v === true)} />
              <div className="space-y-0.5">
                <Label htmlFor={`${id}-your-brand`} className="text-sm">
                  Your brand
                </Label>
                <p className="text-xs text-muted-foreground">You are promoting yourself or your own business.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox id={`${id}-branded`} checked={brandedContent} onCheckedChange={(v) => {
                    setBrandedContent(v === true);
                    // Branded content cannot be private: an "Only me" already chosen is cleared, so the merchant chooses again.
                    if (v === true && privacy === SELF_ONLY) setPrivacy(null);
                  }} />
              <div className="space-y-0.5">
                <Label htmlFor={`${id}-branded`} className="text-sm">
                  Branded content
                </Label>
                <p className="text-xs text-muted-foreground">You are paid, or given something, to promote another brand.</p>
              </div>
            </div>
            {problems.some((p) => p.key === "commercial_kind") ? (
              <p className="text-xs text-muted-foreground" role="status">
                Choose at least one.
              </p>
            ) : null}
          </div>
        ) : null}
      </fieldset>

      <div className="space-y-3 border-t pt-4">
        {/* Always drawn, so the button's aria-describedby always points at an element that exists. */}
        <ul id={`${id}-why`} className="space-y-1 text-xs text-muted-foreground" data-testid="tiktok-problems" role="status">
          {problems.map((p) => (
            <li key={p.key + p.message} data-problem={p.key}>
              {p.message}
            </li>
          ))}
        </ul>
        <Button type="button" onClick={() => save.mutate()} disabled={problems.length > 0 || save.isPending || answered} aria-busy={save.isPending} aria-describedby={`${id}-why`}>
          {save.isPending ? "Saving..." : "Post"}
        </Button>
        <p className="text-xs text-muted-foreground" data-testid="tiktok-declaration">
          By posting, you agree to TikTok&apos;s{" "}
          <a href={MUSIC_USAGE_URL} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
            Music Usage Confirmation
          </a>
          {commercial && brandedContent ? (
            <>
              {" "}
              and{" "}
              <a href={BRANDED_CONTENT_POLICY_URL} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
                Branded Content Policy
              </a>
            </>
          ) : null}
          .
        </p>
        {failure ? (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {failure}
          </p>
        ) : null}
        {answered ? (
          <p role="status" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-on-tint" data-testid="tiktok-coming-soon">
            {TIKTOK_COMING_SOON_MESSAGE}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SwitchRow({
  id,
  label,
  checked,
  onChange,
  disabled,
  note,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  note?: string | undefined;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        {note ? (
          <p id={`${id}-note`} className="text-xs text-muted-foreground">
            {note}
          </p>
        ) : null}
      </div>
      <Switch id={id} checked={checked && !disabled} onCheckedChange={onChange} disabled={disabled} aria-describedby={note ? `${id}-note` : undefined} />
    </div>
  );
}
