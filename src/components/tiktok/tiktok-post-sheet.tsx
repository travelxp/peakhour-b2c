"use client";

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api";
import { tiktokContentApi, type TikTokCreatorInfo } from "@/lib/api/tiktok-content";
import { reconnectHref } from "@/lib/integrations-connect";
import type { ScheduledItemDto } from "@/lib/scheduler/types";
import {
  TIKTOK_COMING_SOON_MESSAGE,
  TIKTOK_PATH,
  TIKTOK_PROVIDER,
  commercialLabel,
  isVideoPayload,
  postProblems,
  privacyDisabled,
  privacyLabel,
  rememberPostRequest,
  tiktokAccountState,
} from "@/lib/tiktok-content-view";

/** TikTok's own pages for the two declarations. */
export const MUSIC_USAGE_URL = "https://www.tiktok.com/legal/page/global/music-usage-confirmation/en";
export const BRANDED_CONTENT_POLICY_URL = "https://www.tiktok.com/legal/page/global/bc-policy/en";

export interface TikTokPostSheetProps {
  /** The approved item to post. Null closes the sheet. */
  item: ScheduledItemDto | null;
  onOpenChange: (open: boolean) => void;
  /** Called once the merchant pressed Post (nothing was sent to TikTok). */
  onRequested?: (itemId: string) => void;
}

/**
 * The TikTok post sheet: the last step before a post, built to TikTok's Content Posting requirements (the account, the preview, who can see it,
 * comments, Duet and Stitch, commercial content, the declaration, the length limit).
 *
 * ★POST SENDS NOTHING. TikTok has not approved Peakhour to publish, so the button answers on the sheet and remembers the request for this tab;
 * it calls no publish route and nothing on screen says the post is live.
 */
export function TikTokPostSheet({ item, onOpenChange, onRequested }: TikTokPostSheetProps) {
  return (
    <Sheet open={item !== null} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="text-base">Post to TikTok</SheetTitle>
          <SheetDescription className="text-xs">Check how this post will look and choose who can see it.</SheetDescription>
        </SheetHeader>
        {item ? <SheetBody key={item._id} item={item} onRequested={onRequested} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function SheetBody({ item, onRequested }: { item: ScheduledItemDto; onRequested: ((id: string) => void) | undefined }) {
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
  return <PostForm item={item} creator={creator.data} onRequested={onRequested} />;
}

function PostForm({ item, creator, onRequested }: { item: ScheduledItemDto; creator: TikTokCreatorInfo; onRequested: ((id: string) => void) | undefined }) {
  const id = useId();
  const media = item.payload.mediaUrls ?? [];
  const video = isVideoPayload(media);

  // No privacy level is chosen for the merchant: the audience of a post is theirs to decide.
  const [chosenPrivacy, setPrivacy] = useState<string | null>(null);
  const [comments, setComments] = useState(false);
  const [duet, setDuet] = useState(false);
  const [stitch, setStitch] = useState(false);
  const [commercial, setCommercial] = useState(false);
  const [yourBrand, setYourBrand] = useState(false);
  const [brandedContent, setBrandedContent] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);

  // Branded content cannot be private: a chosen "Only me" stops counting once branded content is on, so the merchant chooses again.
  const privacy = chosenPrivacy !== null && privacyDisabled(chosenPrivacy, { commercial, brandedContent }) ? null : chosenPrivacy;
  const choices = { privacy, commercial, yourBrand, brandedContent };
  const problems = postProblems(choices, video ? { kind: "video", durationSec: duration } : { kind: "photos" }, creator.maxVideoPostDurationSec);
  const label = commercialLabel(choices);
  const tooLong = problems.some((p) => p.key === "duration");

  function post() {
    // ★No publish call. The request is remembered for this tab so the status reads "Waiting for TikTok approval".
    rememberPostRequest(item._id);
    onRequested?.(item._id);
    setAnswered(true);
  }

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
            onLoadedMetadata={(e) => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : null)}
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

      {tooLong ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" data-testid="tiktok-too-long">
          {problems.find((p) => p.key === "duration")?.message}
        </p>
      ) : null}

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
              <Checkbox id={`${id}-branded`} checked={brandedContent} onCheckedChange={(v) => setBrandedContent(v === true)} />
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
        {problems.length > 0 && !tooLong ? (
          <ul id={`${id}-why`} className="space-y-1 text-xs text-muted-foreground" data-testid="tiktok-problems">
            {problems.map((p) => (
              <li key={p.key + p.message}>{p.message}</li>
            ))}
          </ul>
        ) : null}
        <Button type="button" onClick={post} disabled={problems.length > 0} aria-describedby={problems.length > 0 ? `${id}-why` : undefined}>
          Post
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
