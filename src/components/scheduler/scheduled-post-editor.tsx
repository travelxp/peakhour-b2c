"use client";

/**
 * <ScheduledPostEditor /> — everything you can do to a post that has not gone
 * out yet: change the words, change the media, change the time, send it now, or
 * call it off.
 *
 * ★ONE COMPONENT, TWO HOSTS (the LinkedIn hub's Scheduled tab and the
 * calendar's per-item drawer). These are the same four decisions about the same
 * row, and the moment they are two implementations, one of them gets the
 * publish-now confirmation and the other does not.
 *
 * ★IT ONLY OFFERS WHAT A PUBLISHER ACTUALLY HONOURS. The calendar spans every
 * channel, and the adapters differ in what they read off `payload`: LinkedIn /
 * Facebook / Instagram upload `mediaUrls`, X ignores them and publishes
 * `threadParts[0]` in place of `text`, and `firstComment` is read by NO adapter
 * at all. A uniform form over that would accept edits, save them, toast success
 * and publish something else — so the capability table below decides which
 * controls render, and an unsupported field is shown read-only rather than
 * hidden or (worse) offered.
 *
 * What it does NOT offer, deliberately:
 *   - Changing the AUTHOR / visibility. Those live in `payload.channelOptions`,
 *     which the server refuses to patch: the plan was committed against an
 *     author the publish policy approved, and letting a text edit swap the Page
 *     would route round that check. Changing who posts = cancel and recompose.
 *   - A timezone override. `PATCH /items/:id/reschedule` takes an instant only
 *     and the API copies `audienceTimezone` onto the successor row, so the
 *     control would change the displayed wall-clock and nothing else.
 *   - Editing a published / failed / cancelled item. Nothing to change.
 *
 * The host owns the container (sheet, drawer, card) and refetching. This owns
 * the form, the three mutations, and the confirmations.
 */

import { useEffect, useId, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  Image as ImageIcon,
  Loader2,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { LibraryMediaPicker } from "@/components/media/library-media-picker";
import { ScheduleTimePicker } from "@/components/scheduler/schedule-time-picker";
import { PlatformCharCounter } from "@/components/composer/platform-char-counter";
import { scheduler } from "@/lib/scheduler/client";
import { channelDisplayName, formatScheduleLabel } from "@/lib/scheduler/format";
import { ApiError } from "@/lib/api";
import type { PlatformKey } from "@/components/composer/types";
import type { ScheduledItemDto } from "@/lib/scheduler/types";

/**
 * Channels whose publisher adapter actually uploads `payload.mediaUrls`
 * (`adapters/publisher/{linkedin,facebook,instagram}.ts`). X, Beehiiv, WordPress
 * and Shopify never read the field, and the scheduler's own validation would
 * still accept it — so attaching there saves cleanly and then vanishes at
 * publish with no error. Extend this when an adapter learns to send media.
 */
const MEDIA_CHANNELS = new Set<string>(["linkedin", "facebook", "instagram"]);

/** Channels the shared composer char-counter knows. Anything else renders no
 *  counter rather than guessing a limit and lying about it. */
const COUNTER_PLATFORMS = new Set<string>([
  "linkedin",
  "x",
  "facebook",
  "instagram",
  "threads",
  "bluesky",
]);

/** `scd_scheduled_items.payload.mediaUrls` maxItems. The per-channel limit is
 *  stricter and lives server-side; this is only the hard ceiling. */
const PAYLOAD_MEDIA_CAP = 12;

/**
 * Statuses whose payload and time can still be changed. Mirrors the server's
 * editable set exactly — including `ready`, which is what a worker leaves
 * behind when it dies mid-lease. Excluding it here while the API accepted it
 * left a crashed row with a read-only panel and no actions at all, cancel
 * included.
 */
function isEditable(status: ScheduledItemDto["status"]): boolean {
  return (
    status === "queued" ||
    status === "awaiting_retry" ||
    status === "ready" ||
    status === "needs_action"
  );
}

/** Statuses the API refuses to publish early, each with its own reason. */
function publishNowBlockedReason(item: ScheduledItemDto): string | null {
  if (item.payloadStale) {
    return "This post is held for review — save it below first.";
  }
  if (item.status === "awaiting_retry") {
    return "This post hit a snag and is already queued to retry. Forcing it now would use up its remaining attempts.";
  }
  if (item.status === "needs_action") {
    return "This post is paused and needs attention before it can publish.";
  }
  if (item.status === "ready") {
    return "A publish is already being set up for this post.";
  }
  return null;
}

export interface ScheduledPostEditorProps {
  item: ScheduledItemDto;
  /** Called after any mutation lands, so the host can refetch its list. */
  onChanged: () => void;
  /** Called after a cancel, so the host can close its container. */
  onCancelled?: () => void;
}

export function ScheduledPostEditor({
  item,
  onChanged,
  onCancelled,
}: ScheduledPostEditorProps) {
  // Hardcoded ids would collide the moment a host renders two of these (a list
  // that expands more than one row at a time), silently pointing the <Label> at
  // the first instance's field.
  const uid = useId();
  const textId = `${uid}-text`;

  /**
   * What "saved" currently means — its own state, not a read of `item.payload`.
   *
   * ★A save lands on the server BEFORE the host's refetch delivers the new row,
   * so comparing the form against the PROP left the editor claiming "Unsaved
   * edits" for changes already written — and, because Reschedule and Publish now
   * both gate on clean content, disabled them on a post that was in fact clean.
   * The mutation returns the stored payload, so it becomes the new baseline the
   * moment it lands and the dirty flags are honest from the first frame.
   */
  const [baseline, setBaseline] = useState({
    text: item.payload.text,
    mediaUrls: item.payload.mediaUrls ?? [],
  });
  const [text, setText] = useState(item.payload.text);
  const [mediaUrls, setMediaUrls] = useState<string[]>(item.payload.mediaUrls ?? []);
  const [when, setWhen] = useState<Date>(new Date(item.scheduledAtUtc));
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);

  /**
   * Two re-seeds, split on purpose.
   *
   * CONTENT re-seeds whenever the stored snapshot changes (`payload.version`
   * bumps on every save). TIME re-seeds only when the host swaps in a different
   * ROW.
   *
   * ★They used to be one effect keyed on `id:version`, which discarded a pending
   * time selection on every content save — while the UI was telling the user
   * "Save your changes first" before rescheduling. Following its own instruction
   * threw the chosen time away.
   */
  const contentSeedKey = `${item._id}:${item.payload.version}`;
  useEffect(() => {
    setBaseline({
      text: item.payload.text,
      mediaUrls: item.payload.mediaUrls ?? [],
    });
    setText(item.payload.text);
    setMediaUrls(item.payload.mediaUrls ?? []);
    setConfirmCancel(false);
    setConfirmPublish(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentSeedKey]);

  useEffect(() => {
    setWhen(new Date(item.scheduledAtUtc));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item._id]);

  const editable = isEditable(item.status);
  const canCancel = !isTerminal(item.status);

  // ★An X thread publishes `threadParts[0]`, NOT `payload.text` — so editing the
  // text of a thread item would save, toast success, and publish the original
  // words. The parts are shown read-only instead of pretending otherwise.
  const threadParts = item.payload.threadParts ?? [];
  const isThread = threadParts.length > 0;
  const supportsMedia = MEDIA_CHANNELS.has(item.channel);
  const hashtags = item.payload.hashtags ?? [];

  const contentDirty =
    text !== baseline.text ||
    mediaUrls.length !== baseline.mediaUrls.length ||
    // Element-wise, not a joined string: a delimiter comparison calls two
    // genuinely different lists equal whenever the delimiter appears in a value.
    mediaUrls.some((u, i) => u !== baseline.mediaUrls[i]);
  const timeDirty = when.getTime() !== new Date(item.scheduledAtUtc).getTime();

  const trimmed = text.trim();
  // Affordance only — the server is the gate, rejecting anything more than 5
  // minutes back with BACKDATED_NOT_ALLOWED. This is a render-time clock read,
  // so a form left open across the boundary won't grey the button until
  // something re-renders; the server's rejection (surfaced verbatim) is the
  // backstop, which is why this doesn't need to be exact.
  const timeInPast = when.getTime() < Date.now() - 5 * 60_000;

  const saveContent = useMutation({
    mutationFn: () =>
      scheduler.editItemPayload(item._id, {
        // Text is only sent when this channel publishes it — see isThread.
        ...(isThread ? {} : { text: trimmed }),
        // Sent even when emptied: the server reads an empty collection as
        // "remove it", which is how media gets detached.
        ...(supportsMedia ? { mediaUrls } : {}),
      }),
    onSuccess: (res) => {
      // Adopt what the server stored, for BOTH the baseline and the field. The
      // field matters because we send `text.trim()` while state held the raw
      // value — a trailing newline was enough to leave the form permanently
      // "dirty" after a successful save, which also kept Reschedule and Publish
      // now disabled.
      setBaseline({
        text: res.payload.text,
        mediaUrls: res.payload.mediaUrls ?? [],
      });
      setText(res.payload.text);
      setMediaUrls(res.payload.mediaUrls ?? []);
      toast.success("Scheduled post updated.");
      onChanged();
    },
    onError: (err: unknown) => toast.error(mutationMessage(err, "Couldn't save the changes.")),
  });

  const saveTime = useMutation({
    // mode "item" — this editor shows ONE channel's row, so moving its siblings
    // is not something the user asked for. The calendar's drag gesture is where
    // bundle moves live.
    mutationFn: () => scheduler.rescheduleItem(item._id, { scheduledAtUtc: when, mode: "item" }),
    onSuccess: () => {
      toast.success("Rescheduled.");
      onChanged();
    },
    onError: (err: unknown) => toast.error(mutationMessage(err, "Couldn't reschedule.")),
  });

  const publishNow = useMutation({
    mutationFn: () => scheduler.publishItemNow(item._id),
    onSuccess: (res) => {
      // A 200 does NOT mean published — the server ran a real publish attempt
      // and reports its outcome, so a transient provider error comes back here
      // as a success response describing a failure. Saying "Published" on that
      // would be a lie the user acts on.
      if (res.published) {
        toast.success(`Published to ${channelDisplayName(item.channel)}.`);
      } else {
        toast.warning("Publish attempt didn't go through", {
          description:
            res.outcome === "rate_limited" || res.outcome === "transient_error"
              ? "It will retry automatically — check the attempt log."
              : "See the attempt log for what happened.",
        });
      }
      setConfirmPublish(false);
      onChanged();
    },
    onError: (err: unknown) => {
      setConfirmPublish(false);
      toast.error(mutationMessage(err, "Couldn't publish right now."));
    },
  });

  const cancel = useMutation({
    // ★Cancels the PLAN, not just this item — that is the only cancel the API
    // offers, and for a single-channel post (everything scheduled from a
    // composer) plan and item are the same thing. For a multi-channel bundle it
    // takes every channel down, so the confirmation copy says so.
    mutationFn: () => scheduler.cancelPlan(item.planId, "user_cancelled_from_scheduled_posts"),
    onSuccess: () => {
      toast.success("Scheduled post cancelled.");
      setConfirmCancel(false);
      onChanged();
      onCancelled?.();
    },
    onError: (err: unknown) => {
      setConfirmCancel(false);
      toast.error(mutationMessage(err, "Couldn't cancel."));
    },
  });

  const anyPending =
    saveContent.isPending || saveTime.isPending || publishNow.isPending || cancel.isPending;

  const counterPlatform = useMemo(
    () => (COUNTER_PLATFORMS.has(item.channel) ? (item.channel as PlatformKey) : null),
    [item.channel],
  );

  // Terminal, or mid-publish. `in_flight` keeps CANCEL — the drawer used to
  // offer it for every non-terminal status and removing that quietly was a
  // regression — but nothing else, because a publish is already in the air.
  if (!editable) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          This post is{" "}
          <span className="font-medium">{item.status.replaceAll("_", " ")}</span>
          {canCancel
            ? " — a publish is already under way, so it can't be edited or moved."
            : " — it can no longer be edited, rescheduled or published."}
        </div>
        {canCancel && <CancelBlock cancel={cancel} confirm={confirmCancel} setConfirm={setConfirmCancel} />}
      </div>
    );
  }

  const publishBlocked = publishNowBlockedReason(item);

  return (
    <div className="space-y-4">
      {item.payloadStale && (
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning-on-tint">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <div className="font-medium">Held for review</div>
            <p className="mt-0.5">
              The source content changed after this was scheduled, so publishing
              is paused. Saving your edits below releases it — the post that goes
              out is the one you see here.
            </p>
          </div>
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────── */}
      {isThread ? (
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Thread · {threadParts.length} part{threadParts.length === 1 ? "" : "s"}
          </Label>
          <ol className="space-y-1.5">
            {threadParts.map((part, i) => (
              <li
                key={`${i}-${part.slice(0, 24)}`}
                className="rounded-md border bg-muted/30 p-2.5 text-sm"
              >
                <span className="mr-1.5 text-[11px] tabular-nums text-muted-foreground">
                  {i + 1}.
                </span>
                <span className="whitespace-pre-wrap wrap-break-word">{part}</span>
              </li>
            ))}
          </ol>
          <p className="text-[11px] text-muted-foreground">
            A thread publishes from its parts, so its wording can&apos;t be
            edited here yet — cancel and recompose to change it. You can still
            move it, publish it early, or call it off.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <Label htmlFor={textId} className="text-xs uppercase tracking-wide text-muted-foreground">
              Post
            </Label>
            {counterPlatform && <PlatformCharCounter platform={counterPlatform} value={text} />}
          </div>
          <Textarea
            id={textId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="resize-y"
          />
        </div>
      )}

      {/* Hashtags are a separate array on the payload and DO publish. Shown so
          the person editing can see everything that goes out; editing them is a
          follow-up, and hiding them was worse than showing them read-only. */}
      {hashtags.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Hashtags
          </Label>
          <div className="flex flex-wrap gap-1">
            {hashtags.map((h) => (
              <span
                key={h}
                className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
              >
                #{h}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Media ───────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Media
        </Label>
        {mediaUrls.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {/* Keyed and removed by INDEX, not by url: `commitPlan` does not
                dedupe, so a stored payload can legitimately hold the same url
                twice — removing by value would delete both, and React would warn
                about duplicate keys. */}
            {mediaUrls.map((url, i) => (
              <li key={`${i}-${url}`} className="relative">
                {/* Plain <img>: these are R2 URLs on a host next/image is not
                    configured for, and a scheduled post's thumbnail is not
                    worth a remotePatterns change. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Attachment ${i + 1}`}
                  className="size-16 rounded-md border object-cover"
                />
                {supportsMedia && (
                  <button
                    type="button"
                    onClick={() => setMediaUrls((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute -right-1.5 -top-1.5 rounded-full border bg-background p-0.5 text-muted-foreground shadow-sm hover:text-destructive"
                    aria-label={`Remove attachment ${i + 1}`}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          supportsMedia && <p className="text-xs text-muted-foreground">No attachments.</p>
        )}
        {supportsMedia ? (
          <LibraryMediaPicker
            // Remaining slots against the payload schema's cap, not a guessed
            // per-platform number: the channel's real `maxMediaCount` lives in
            // the server's constraints adapter and is enforced there
            // (TOO_MANY_MEDIA), so inventing a limit here could only be wrong.
            maxSelection={Math.max(0, PAYLOAD_MEDIA_CAP - mediaUrls.length)}
            onSelect={(assets) =>
              setMediaUrls((prev) => {
                // Dedupe by URL — picking the same asset twice would publish it
                // twice, and the picker has no memory of what is already
                // attached.
                const next = [...prev];
                for (const a of assets) if (!next.includes(a.url)) next.push(a.url);
                return next;
              })
            }
            trigger={
              <Button type="button" variant="outline" size="sm" className="gap-1.5">
                <ImageIcon className="size-3.5" /> Add media
              </Button>
            }
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            {channelDisplayName(item.channel)} posts publish without attachments
            {mediaUrls.length > 0 ? " — these won't be sent." : "."}
          </p>
        )}
      </div>

      {!isThread && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => saveContent.mutate()}
            disabled={!contentDirty || trimmed.length === 0 || anyPending}
            aria-busy={saveContent.isPending}
            className="gap-1.5"
            title={
              trimmed.length === 0
                ? "A scheduled post needs some text"
                : contentDirty
                  ? undefined
                  : "No changes to save"
            }
          >
            {saveContent.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Save changes
          </Button>
          {contentDirty && (
            <span className="text-xs text-muted-foreground">Unsaved edits</span>
          )}
        </div>
      )}

      <Separator />

      {/* ── When ────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
          <CalendarClock className="size-3.5" /> Scheduled for
        </Label>
        <p className="text-xs text-muted-foreground">
          Currently {formatScheduleLabel(item.scheduledAtUtc, item.audienceTimezone)}
        </p>
        <ScheduleTimePicker
          value={when}
          timezone={item.audienceTimezone}
          onChange={(next) => setWhen(next.date)}
          // The reschedule endpoint takes an instant and copies the item's
          // existing audienceTimezone onto the successor, so an override here
          // would move the displayed wall-clock and change nothing that ships.
          allowTimezoneOverride={false}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => saveTime.mutate()}
            // ★Blocked while content edits are unsaved, and that is not
            // fussiness: a reschedule is a server-side cancel-and-reinsert that
            // COPIES THE STORED PAYLOAD onto the successor row. Moving the time
            // with unsaved text in the box would silently publish the old words
            // at the new time and discard the new ones, with a success toast.
            disabled={!timeDirty || timeInPast || contentDirty || anyPending}
            aria-busy={saveTime.isPending}
            className="gap-1.5"
            title={
              contentDirty
                ? "Save your changes first — rescheduling re-snapshots the saved post, so unsaved edits would be lost"
                : timeInPast
                  ? "Pick a future time — a past time can't be scheduled"
                  : timeDirty
                    ? undefined
                    : "Pick a different time first"
            }
          >
            {saveTime.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Reschedule
          </Button>
          {timeInPast && (
            <span className="text-xs text-destructive">That time has passed.</span>
          )}
          {contentDirty && timeDirty && !timeInPast && (
            <span className="text-xs text-muted-foreground">
              Save your changes first.
            </span>
          )}
        </div>
      </div>

      <Separator />

      {/* ── Publish now / cancel ────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {!confirmPublish ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setConfirmPublish(true)}
            // Every state the API refuses is refused here too, with the API's
            // own reason — offering the button and then surfacing a 409 makes
            // the product look broken for rows the panel has just flagged as
            // needing attention.
            disabled={anyPending || contentDirty || publishBlocked !== null}
            className="gap-1.5"
            title={
              publishBlocked ??
              (contentDirty
                ? "Save your edits first, or they won't be in the published post"
                : "Publish immediately instead of waiting")
            }
          >
            <Send className="size-3.5" /> Publish now
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5">
            {/* Publishing is not undoable from here — say so before, not after. */}
            <span className="text-xs">
              Publish to {channelDisplayName(item.channel)} now? This can&apos;t be undone.
            </span>
            <Button
              type="button"
              size="sm"
              onClick={() => publishNow.mutate()}
              aria-busy={publishNow.isPending}
              disabled={publishNow.isPending}
              className="gap-1.5"
            >
              {publishNow.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Publish
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirmPublish(false)}
              disabled={publishNow.isPending}
            >
              Keep scheduled
            </Button>
          </div>
        )}

        <CancelBlock
          cancel={cancel}
          confirm={confirmCancel}
          setConfirm={setConfirmCancel}
          disabled={anyPending}
        />
      </div>

      {publishBlocked && !contentDirty && (
        <p className="text-[11px] text-muted-foreground">{publishBlocked}</p>
      )}

      {/* The one thing this editor can't change, said plainly rather than
          offered as a control the server would reject. */}
      <p className="text-[11px] text-muted-foreground">
        Publishing as the page and audience this post was scheduled with. To
        change those, cancel it and compose again.
      </p>
    </div>
  );
}

/** Cancel + its confirmation. Extracted so the read-only `in_flight` branch and
 *  the full editor offer exactly the same control, worded the same way. */
function CancelBlock({
  cancel,
  confirm,
  setConfirm,
  disabled,
}: {
  cancel: { mutate: () => void; isPending: boolean };
  confirm: boolean;
  setConfirm: (v: boolean) => void;
  disabled?: boolean;
}) {
  if (!confirm) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5 text-destructive"
        onClick={() => setConfirm(true)}
        disabled={disabled || cancel.isPending}
      >
        <Trash2 className="size-3.5" /> Cancel post
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5">
      <span className="text-xs">
        Cancel this scheduled post? It won&apos;t publish. If it was scheduled to
        other channels at the same time, those are cancelled too.
      </span>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        onClick={() => cancel.mutate()}
        aria-busy={cancel.isPending}
        disabled={cancel.isPending}
        className="gap-1.5"
      >
        {cancel.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
        Cancel it
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setConfirm(false)}
        disabled={cancel.isPending}
      >
        Keep it
      </Button>
    </div>
  );
}

function isTerminal(status: ScheduledItemDto["status"]): boolean {
  return (
    status === "published" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "skipped"
  );
}

/** Prefer the API's own message — the scheduler returns specific, readable
 *  codes (TEXT_TOO_LONG, ITEM_PAYLOAD_STALE, ITEM_IN_FLIGHT) whose messages
 *  are better than any generic fallback we'd write here. */
function mutationMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.message) return err.message;
  return fallback;
}
