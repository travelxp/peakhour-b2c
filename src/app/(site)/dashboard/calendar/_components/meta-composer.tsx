"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, Loader2, Send, X as XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AiComposeToolbar,
  ComposerShell,
  DrivePicker,
  EmojiPickerTrigger,
  HashtagSuggest,
  PlatformCharCounter,
  type AiActionContext,
  type HashtagCandidate,
} from "@/components/composer";
import { PLATFORM_LIMITS } from "@/components/composer/types";
import { SchedulerComposer } from "@/components/scheduler/scheduler-composer";
import { MediaImage } from "@/components/shared/media-image";
import { ApiError } from "@/lib/api";
import { rewriteContent } from "@/lib/api/content";
import { insertAtCaret } from "@/lib/composer/caret";
import { scheduler } from "@/lib/scheduler/client";
import { detectTimezone } from "@/lib/scheduler/format";
import { sourceTextHash } from "@/lib/scheduler/source-hash";
import {
  CONNECTED_ACCOUNTS_LABEL,
  META_COMPOSE_RULES,
  buildMetaChannel,
  metaPostProblems,
  metaPostTitle,
  metaTextLength,
  publishedLink,
  type MetaComposeChannel,
  type MetaMedia,
} from "@/lib/meta-compose";
import { aiOpToast } from "@/app/(site)/dashboard/content/linkedin/_components/composer-helpers";

/**
 * <MetaComposer/> - write a new Facebook, Instagram or Threads post from scratch, then publish it now or schedule it.
 *
 * ONE composer for the three channels; what differs between them (the limit, whether a picture is required, whether a link is
 * allowed) lives in `META_COMPOSE_RULES`, not in three components. Both "Publish now" and "Schedule" go through the scheduler, so the
 * post is made by the same publisher either way and shows up on the calendar: "Publish now" commits a post for this minute and
 * asks the scheduler to send it (`publishItemNow`, the calendar's own Publish now).
 *
 * ★WHERE THE POST GOES IS NOT CHOSEN HERE. The publisher uses the Page or account saved on the connection; this screen names it
 * (`postingTo`) and points at Connected accounts to change it. It sends no page id.
 */

/** A hashtag typed here is one Meta takes: letters, digits and underscores (Instagram and Facebook split a tag at anything else). */
function isValidTag(query: string): boolean {
  return /^[\p{L}\p{N}_]{2,}$/u.test(query);
}

interface Published {
  channel: MetaComposeChannel;
  href: string;
  label: string;
  external: boolean;
}

export interface MetaComposerProps {
  channel: MetaComposeChannel;
  /** "Posting to Acme Bakery", from the connection. Null when the connection does not say. */
  postingTo: string | null;
}

export function MetaComposer({ channel, postingTo }: MetaComposerProps) {
  const rules = META_COMPOSE_RULES[channel];
  const queryClient = useQueryClient();

  const [text, setText] = useState("");
  const [caret, setCaret] = useState(0);
  const [media, setMedia] = useState<(MetaMedia & { name?: string })[]>([]);
  const [link, setLink] = useState("");
  const [mode, setMode] = useState<"compose" | "schedule">("compose");
  const [failure, setFailure] = useState<{ message: string; calendar: boolean } | null>(null);
  const [done, setDone] = useState<Published | null>(null);
  // The item Publish now has already created. Once it exists the post is on the calendar, so pressing again must NOT make a second one:
  // the screen locks to that post and "Try again" re-sends the same item (see `publishNow`).
  const [sent, setSentState] = useState<{ itemId: string; planId: string } | null>(null);
  // Mirrors `sent` for the mutation callbacks, which can run from a render older than the commit they are reporting on.
  const sentRef = useRef<{ itemId: string; planId: string } | null>(null);
  const setSent = useCallback((next: { itemId: string; planId: string } | null) => {
    sentRef.current = next;
    setSentState(next);
  }, []);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const caretRef = useRef(0);

  const draft = useMemo(() => ({ text, media, link }), [text, media, link]);
  const problems = useMemo(() => metaPostProblems(channel, draft), [channel, draft]);
  // Nothing is said about an empty box until the merchant has typed or added something: "Write something" under a blank form is noise.
  const touched = text !== "" || media.length > 0 || link !== "";
  const blocked = problems.length > 0;
  const locked = sent !== null;
  const limits = useMemo(() => ({ ...PLATFORM_LIMITS[channel], maxChars: rules.maxChars }), [channel, rules.maxChars]);

  /** The merchant changed something: a banner about the last attempt no longer describes what is on screen. */
  const edited = useCallback(() => {
    setDone(null);
    setFailure(null);
  }, []);

  const reset = useCallback(() => {
    setText("");
    setMedia([]);
    setLink("");
    setCaret(0);
    caretRef.current = 0;
    setMode("compose");
    setFailure(null);
    setDone(null);
    setSent(null);
  }, []);

  const insertSnippet = useCallback((snippet: string): string => {
    const { text: next, caret: nextCaret } = insertAtCaret(textareaRef.current?.value ?? "", caretRef.current, snippet);
    setText(next);
    setCaret(nextCaret);
    caretRef.current = nextCaret;
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(nextCaret, nextCaret);
    });
    return next;
  }, []);

  const handleAiAction = useCallback(
    async (ctx: AiActionContext): Promise<string> => {
      const res = await rewriteContent({ op: ctx.op, text: ctx.text, platform: channel, ...(ctx.extras ? { extras: ctx.extras } : {}) });
      let next: string;
      if (res.insert === true) {
        next = insertSnippet(res.text);
      } else {
        next = res.text;
        setText(next);
      }
      const t = aiOpToast(ctx.op, ctx.text, next);
      if (t.success) toast.success(t.message);
      else toast.info(t.message);
      return next;
    },
    [channel, insertSnippet],
  );

  const searchHashtags = useCallback(async (): Promise<HashtagCandidate[]> => [], []);

  function captureCaret(el: HTMLTextAreaElement) {
    const pos = el.selectionStart ?? el.value.length;
    setCaret(pos);
    caretRef.current = pos;
  }

  // ── What is sent ────────────────────────────────────────────────
  const entry = useMemo(() => buildMetaChannel(channel, draft), [channel, draft]);
  const source = useMemo(() => ({ sourceType: "ad_hoc" as const, sourceTextHash: sourceTextHash(text.trim()) }), [text]);
  const title = useMemo(() => metaPostTitle(text), [text]);

  const publishNow = useMutation({
    mutationFn: async (): Promise<Published | { failed: string }> => {
      // ONE ITEM PER POST. The first press commits it; every later press (after a failed or retrying attempt, or a network error
      // between the commit and the send) re-sends that same item instead of committing a second one that would post the text twice.
      let target = sentRef.current;
      if (!target) {
        const plan = await scheduler.commitPlan({
          title,
          source,
          channels: [entry],
          staggerStrategy: "synchronized",
          canonicalScheduledAtUtc: new Date().toISOString(),
          timezone: detectTimezone(),
        });
        const created = plan.scheduledItemIds[0];
        if (!created) return { failed: "Nothing was created. Try again." };
        target = { itemId: created, planId: plan.planId };
        setSent(target);
      }
      const itemId = target.itemId;
      const result = await scheduler.publishItemNow(itemId);
      // A 200 does not mean published: the server ran a real attempt and reports how it went.
      const { items } = await scheduler.listItems({ planId: target.planId, limit: 1 }).catch(() => ({ items: [] }));
      const item = items[0];
      if (result.published) return { channel, ...publishedLink(channel, item?.externalUrl) };
      const reason = item?.attempts?.at(-1)?.errorMessage;
      const willRetry = result.outcome === "transient_error" || result.outcome === "rate_limited";
      return {
        failed:
          (reason ? `${rules.label} said: ${reason}. ` : `${rules.label} did not take the post. `) +
          (willRetry ? "We will try again shortly; you can follow it on the calendar." : "It is on the calendar if you want to fix it and try again."),
      };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["scheduler:items"] });
      if ("failed" in res) {
        setFailure({ message: res.failed, calendar: true });
        return;
      }
      toast.success(`Published to ${rules.label}.`);
      reset();
      setDone(res);
    },
    onError: (err: unknown) => {
      // Either the commit was refused (a rule, a plan limit, a channel that is not connected: nothing was created) or the send failed
      // after the post was created (then it is on the calendar, and the lock keeps it from being created again).
      const raw = err instanceof ApiError || err instanceof Error ? err.message : "";
      const message =
        raw === "" || raw === "Invalid request body" ? "This post was not accepted. Check the text and pictures, then try again." : raw;
      setFailure({ message, calendar: sentRef.current !== null });
    },
  });

  function handleScheduled() {
    queryClient.invalidateQueries({ queryKey: ["scheduler:items"] });
    reset();
    toast.success(`Scheduled on ${rules.label}.`);
  }

  // ── Schedule view ───────────────────────────────────────────────
  if (mode === "schedule") {
    return (
      <ComposerShell
        mode="schedule"
        scheduleView={{
          noun: "post",
          onBack: () => setMode("compose"),
          scheduler: (
            <SchedulerComposer
              key={source.sourceTextHash}
              source={source}
              title={title}
              channels={[entry]}
              onScheduled={handleScheduled}
            />
          ),
        }}
      />
    );
  }

  // ── Compose view ────────────────────────────────────────────────
  return (
    <ComposerShell
      mode="compose"
      headerSlot={
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm" data-testid="meta-posting-to">
          <span className="font-medium">{postingTo ?? `Posting to your ${rules.label} account`}</span>
          <span className="text-muted-foreground">
            {" "}
            · To change it, go to{" "}
            <Link href="/dashboard/integrations" className="font-medium text-primary underline underline-offset-2 hover:no-underline">
              {CONNECTED_ACCOUNTS_LABEL}
            </Link>
            .
          </span>
        </div>
      }
      toolbarSlot={<AiComposeToolbar text={text} platform={channel} onAiAction={handleAiAction} />}
      actionsBordered
      actionsSlot={
        <>
          <Button type="button" variant="outline" size="sm" onClick={() => setMode("schedule")} disabled={blocked || locked} className="gap-1.5">
            <CalendarClock className="size-4" /> Schedule
          </Button>
          <Button onClick={() => publishNow.mutate()} disabled={blocked || publishNow.isPending} aria-busy={publishNow.isPending} className="gap-1.5">
            {publishNow.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {publishNow.isPending ? "Publishing…" : locked ? "Try again" : "Publish now"}
          </Button>
        </>
      }
      footerSlot={
        <>
          {touched && blocked ? (
            <ul className="space-y-1 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm" role="status" data-testid="meta-problems">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
          {failure ? (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {failure.message}{" "}
              {failure.calendar ? (
                <Link href="/dashboard/calendar" className="font-medium underline underline-offset-2 hover:no-underline">
                  Open the calendar
                </Link>
              ) : null}
            </p>
          ) : null}
          {locked ? (
            <p className="text-sm text-muted-foreground">
              This post is on your calendar now, so it cannot be edited here.{" "}
              <button type="button" onClick={reset} className="font-medium text-primary underline underline-offset-2 hover:no-underline">
                Start a new post
              </button>
            </p>
          ) : null}
          {done ? (
            <p role="status" className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success-on-tint">
              Published to {META_COMPOSE_RULES[done.channel].label}.{" "}
              {done.external ? (
                <a href={done.href} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2 hover:no-underline">
                  {done.label}
                </a>
              ) : (
                <Link href={done.href} className="font-medium underline underline-offset-2 hover:no-underline">
                  {done.label}
                </Link>
              )}
            </p>
          ) : null}
        </>
      }
    >
      <div ref={wrapRef} className="rounded-md border bg-card p-2">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            captureCaret(e.target);
            edited();
          }}
          onSelect={(e) => captureCaret(e.currentTarget)}
          onClick={(e) => captureCaret(e.currentTarget)}
          onKeyUp={(e) => captureCaret(e.currentTarget)}
          onFocus={(e) => captureCaret(e.currentTarget)}
          onBlur={(e) => captureCaret(e.currentTarget)}
          placeholder={channel === "instagram" ? "Write a caption…" : channel === "threads" ? "What's on your mind?" : "What do you want to share?"}
          rows={5}
          readOnly={locked}
          className="resize-none border-0 bg-transparent p-1 shadow-none focus-visible:ring-0"
          aria-label={`${rules.label} post text`}
        />
        <div className="flex items-center justify-end gap-3 px-1">
          {rules.maxHashtags !== undefined ? (
            <span className="text-micro text-muted-foreground">Up to {rules.maxHashtags} hashtags</span>
          ) : null}
          <PlatformCharCounter value={metaTextLength(channel, text)} platform={channel} limits={limits} size="sm" showCount />
        </div>
      </div>

      <HashtagSuggest
        containerRef={wrapRef}
        targetRef={textareaRef}
        text={text}
        caret={caret}
        onChange={setText}
        onSearch={searchHashtags}
        validateTag={isValidTag}
        minQueryLength={2}
      />

      {media.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Attached media">
          {media.map((m, i) => (
            <li key={`${m.url}-${i}`} className="relative size-20 overflow-hidden rounded-md border bg-muted">
              {m.mime.startsWith("video/") ? (
                <span className="flex size-full items-center justify-center p-1 text-center text-micro text-muted-foreground">{m.name ?? "Video"}</span>
              ) : (
                <MediaImage src={m.url} alt={m.name ?? "Attached picture"} width={80} height={80} className="size-full object-cover" />
              )}
              {locked ? null : (
                <button
                  type="button"
                  onClick={() => {
                    setMedia((prev) => prev.filter((_, j) => j !== i));
                    edited();
                  }}
                  className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 shadow"
                  aria-label={`Remove ${m.name ?? "picture"}`}
                >
                  <XIcon className="size-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <EmojiPickerTrigger onInsert={insertSnippet} />
        {locked ? null : (
          <DrivePicker
            kinds={[...rules.mediaKinds]}
            maxSelection={Math.max(1, rules.maxMedia - media.length)}
            target={{ channel, label: rules.driveLabel }}
            addLabel="Add to post"
            onSelect={(assets) => {
              // A file already on the post is not added twice; picks beyond the room left are dropped, and the merchant is told.
              const have = new Set(media.map((m) => m.url));
              const fresh = assets.filter((a) => !have.has(a.url));
              const room = Math.max(0, rules.maxMedia - media.length);
              if (fresh.length > room) toast.info(`${rules.label} takes up to ${rules.maxMedia} pictures. Only the first ${room} were added.`);
              setMedia((prev) => [...prev, ...fresh.slice(0, room).map((a) => ({ url: a.url, mime: a.mime, name: a.name }))]);
              edited();
            }}
          />
        )}
        <span className="text-micro text-muted-foreground">
          {rules.mediaRequired ? "A picture or video is needed." : "Pictures are optional."}
        </span>
      </div>

      {rules.link ? (
        <div className="space-y-1">
          <Label htmlFor="meta-link" className="text-xs uppercase tracking-wide text-muted-foreground">
            Link (optional)
          </Label>
          <Input
            id="meta-link"
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              edited();
            }}
            readOnly={locked}
            placeholder="https://"
            inputMode="url"
          />
        </div>
      ) : null}
    </ComposerShell>
  );
}
