"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  CalendarClock,
  Command as CommandIcon,
  Loader2,
  Plus,
  Quote,
  Reply,
  Send,
  Sparkles,
  Trash2,
  Wand2,
  X as XIcon,
} from "lucide-react";
import { xApi, extractTweetId, type PublishTweetInput } from "@/lib/api/x";
import { ApiError } from "@/lib/api";
import {
  rewriteContent,
  createDraft,
  updateDraft,
  getVoiceCards,
  type ComposerDraftRef,
  type VoiceCardDoc,
} from "@/lib/api/content";
import {
  AiComposeToolbar,
  ComposerCommandPalette,
  DraftSaver,
  EmojiPickerTrigger,
  HashtagSuggest,
  PlatformCharCounter,
  VoiceCardPreview,
  useDraftSaver,
  type AiActionContext,
  type ComposerCommand,
  type HashtagCandidate,
  type VoiceCardSummary,
} from "@/components/composer";
import { SchedulerComposer } from "@/components/scheduler/scheduler-composer";
import type { ScheduleSourceType } from "@/lib/scheduler/types";
import { sourceTextHash } from "@/lib/scheduler/source-hash";
import { insertAtCaret } from "@/lib/composer/caret";
import { cn } from "@/lib/utils";

const MAX_LEN = 280;

/** A single tweet in the composer. `id` is STABLE for the life of the
 *  segment (not the array index) so React keys + the ref maps survive
 *  removing/reordering a middle tweet — the index-keyed approach made
 *  the DOM caret/IME state stick to the wrong tweet. */
interface Segment {
  id: string;
  text: string;
}

// Monotonic id source. Module-level (not Date/random) so ids are stable
// + collision-free across the session without pulling in a uuid dep.
let segmentSeq = 0;
function makeSegment(text = ""): Segment {
  segmentSeq += 1;
  return { id: `seg-${segmentSeq}`, text };
}

/** Compose vs. schedule view — mirrors the LinkedIn composer. */
type ComposerMode = "compose" | "schedule";

/** Reply / quote reference attached to the ROOT tweet (segment 0). */
type RefMode =
  | { kind: "none" }
  | { kind: "reply"; id: string; raw: string }
  | { kind: "quote"; id: string; raw: string };

/** X hashtags are ASCII letters/digits/underscore only — pass this to
 *  HashtagSuggest so users don't pick "Create #🔥" the publish API then
 *  rejects (the primitive's default validator allows Unicode letters). */
function isValidXHashtag(query: string): boolean {
  return /^[A-Za-z0-9_]{2,}$/.test(query);
}

function aiOpToast(op: AiActionContext["op"]): string {
  switch (op) {
    case "compose":
      return "Draft generated.";
    case "redraft":
      return "Tweet rewritten.";
    case "shorten":
      return "Tweet shortened.";
    case "lengthen":
      return "Tweet expanded.";
    case "tone":
      return "Tone updated.";
    case "quote":
      return "Quote inserted.";
    case "disclosure":
      return "Disclosure inserted.";
  }
}

/** Map the generic voice-cards payload to the chip summary. Best-effort
 *  — the chip is informational (brand voice is also injected server-side
 *  by the rewrite skill), so a missing card just renders nothing. */
function mapXVoiceCard(cards: VoiceCardDoc[] | undefined): VoiceCardSummary | null {
  if (!cards || cards.length === 0) return null;
  const card = cards[0];
  return {
    id: card._id ?? "x-voice",
    channel: "x",
    category: card.category,
    toneAdjectives: card.voice?.tone ?? [],
    signaturePhrases: card.voice?.signaturePhrases ?? [],
    avoidPhrases: card.voice?.avoidPhrases ?? [],
    refreshedAt: card.lastGeneratedAt ?? card.updatedAt,
  };
}

export function TweetComposer() {
  const queryClient = useQueryClient();

  // ── Thread state ────────────────────────────────────────────────
  // segments[0] is the root tweet; length > 1 = a thread. The composer
  // edits the ACTIVE segment (tracked by id, not index); the AI toolbar
  // / emoji / hashtag primitives all operate on it. activeId + caret
  // are the source of truth for "where an insert lands"; refs mirror
  // them for the async AI handler (same pattern as the LinkedIn
  // composer).
  const [segments, setSegments] = useState<Segment[]>(() => [makeSegment()]);
  const [activeId, setActiveId] = useState<string>(() => segments[0]!.id);
  const [caret, setCaret] = useState(0);
  const segmentsRef = useRef<Segment[]>(segments);
  const activeIdRef = useRef<string>(activeId);
  const caretRef = useRef(0);
  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);
  useEffect(() => {
    caretRef.current = caret;
  }, [caret]);

  // Element maps keyed by STABLE segment id (not index) — survive a
  // middle-segment removal without mis-associating DOM nodes.
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement | null>>(new Map());
  const wrapRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  // Stable ref objects the single HashtagSuggest reads — repointed each
  // render to the active segment's elements.
  const activeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const activeWrapRef = useRef<HTMLDivElement | null>(null);
  activeTextareaRef.current = textareaRefs.current.get(activeId) ?? null;
  activeWrapRef.current = wrapRefs.current.get(activeId) ?? null;

  // ── Other composer state ────────────────────────────────────────
  const [mode, setMode] = useState<ComposerMode>("compose");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const createInFlightRef = useRef<Promise<ComposerDraftRef> | null>(null);

  const [refMode, setRefMode] = useState<RefMode>({ kind: "none" });
  const [showRefs, setShowRefs] = useState(false);
  const [refInput, setRefInput] = useState("");
  const [refError, setRefError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const isThread = segments.length > 1;
  const activeText = segments.find((s) => s.id === activeId)?.text ?? "";

  const combinedText = useMemo(
    () => segments.map((s) => s.text.trim()).filter(Boolean).join("\n\n"),
    [segments],
  );
  const empty = combinedText.length === 0;
  const anyTooLong = segments.some((s) => s.text.length > MAX_LEN);

  // ── Voice card chip (informational) ─────────────────────────────
  const voiceCardQuery = useQuery({
    queryKey: ["x-voice-card"],
    queryFn: () => getVoiceCards({ channel: "x" }),
    retry: (failureCount, err) => {
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) return false;
      return failureCount < 2;
    },
    staleTime: 5 * 60_000,
  });
  const voiceSummary = useMemo(() => mapXVoiceCard(voiceCardQuery.data), [voiceCardQuery.data]);

  // ── Segment helpers ─────────────────────────────────────────────
  const updateSegment = useCallback((id: string, value: string) => {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, text: value } : s)));
  }, []);

  const addSegment = useCallback(() => {
    const seg = makeSegment();
    setSegments((prev) => [...prev, seg]);
    setActiveId(seg.id);
    activeIdRef.current = seg.id;
    setCaret(0);
    caretRef.current = 0;
    requestAnimationFrame(() => textareaRefs.current.get(seg.id)?.focus());
  }, []);

  const removeSegment = useCallback(
    (id: string) => {
      setSegments((prev) => {
        if (prev.length <= 1) return prev;
        const idx = prev.findIndex((s) => s.id === id);
        const next = prev.filter((s) => s.id !== id);
        // If the active segment is the one being removed, move focus to
        // the previous tweet (or the new first) — tracked by id, so no
        // index drift when an earlier segment is removed.
        if (activeIdRef.current === id) {
          const newActive = next[Math.max(0, idx - 1)] ?? next[0]!;
          setActiveId(newActive.id);
          activeIdRef.current = newActive.id;
          const len = newActive.text.length;
          setCaret(len);
          caretRef.current = len;
        }
        return next;
      });
      textareaRefs.current.delete(id);
      wrapRefs.current.delete(id);
    },
    [],
  );

  function captureCaret(id: string, el: HTMLTextAreaElement) {
    setActiveId(id);
    activeIdRef.current = id;
    const pos = el.selectionStart ?? el.value.length;
    setCaret(pos);
    caretRef.current = pos;
  }

  // ── Caret-aware snippet insertion (emoji + AI insert ops) ───────
  const insertSnippet = useCallback(
    (snippet: string): string => {
      const id = activeIdRef.current;
      const current = segmentsRef.current.find((s) => s.id === id)?.text ?? "";
      const { text: next, caret: nextCaret } = insertAtCaret(current, caretRef.current, snippet);
      updateSegment(id, next);
      setCaret(nextCaret);
      caretRef.current = nextCaret;
      requestAnimationFrame(() => {
        const el = textareaRefs.current.get(id);
        if (!el) return;
        el.focus();
        el.setSelectionRange(nextCaret, nextCaret);
      });
      return next;
    },
    [updateSegment],
  );

  // ── AI compose toolbar handler (operates on the active segment) ──
  const handleAiAction = useCallback(
    async (ctx: AiActionContext): Promise<string> => {
      const res = await rewriteContent({
        op: ctx.op,
        text: ctx.text,
        platform: "x",
        ...(ctx.extras ? { extras: ctx.extras } : {}),
      });
      // Insert ops (quote/disclosure) splice at the caret; a missing
      // `insert` (older API) falls back to a full-segment replace.
      let newText: string;
      if (res.insert === true) {
        newText = insertSnippet(res.text);
      } else {
        newText = res.text;
        updateSegment(activeIdRef.current, newText);
      }
      toast.success(aiOpToast(ctx.op));
      return newText;
    },
    [insertSnippet, updateSegment],
  );

  // No hashtag-history endpoint for X yet — surface only the inline
  // "Create #tag" affordance, gated by the X-ASCII validator.
  const searchHashtags = useCallback(async (): Promise<HashtagCandidate[]> => [], []);

  // ── Draft auto-save ─────────────────────────────────────────────
  const saveDraft = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (trimmed.length === 0) return;
      if (draftId) {
        await updateDraft(draftId, { text: value });
        return;
      }
      if (createInFlightRef.current) {
        const ref = await createInFlightRef.current;
        await updateDraft(ref.draftId, { text: value });
        return;
      }
      const p = createDraft({ text: value, channel: "x" });
      createInFlightRef.current = p;
      try {
        const ref = await p;
        setDraftId(ref.draftId);
      } finally {
        createInFlightRef.current = null;
      }
    },
    [draftId],
  );

  const {
    status: draftStatus,
    lastSavedAt,
    lastError: draftError,
    saveNow,
  } = useDraftSaver<string>({
    value: combinedText.length > 0 ? combinedText : null,
    save: saveDraft,
  });

  // ── Reset after publish/schedule ────────────────────────────────
  const resetComposer = useCallback(() => {
    const fresh = makeSegment();
    setSegments([fresh]);
    setActiveId(fresh.id);
    activeIdRef.current = fresh.id;
    setCaret(0);
    caretRef.current = 0;
    textareaRefs.current.clear();
    wrapRefs.current.clear();
    setRefMode({ kind: "none" });
    setRefInput("");
    setShowRefs(false);
    setDraftId(null);
    setMode("compose");
  }, []);

  // ── Instant publish (single tweet OR reply-chained thread) ──────
  const publish = useMutation({
    mutationFn: async () => {
      // Filter ALL empties (not just trailing) so an emptied interior
      // tweet can't post a blank that X rejects mid-chain.
      const segs = segments.map((s) => s.text.trim()).filter(Boolean);
      let posted = 0;
      let prevId: string | undefined;
      for (let i = 0; i < segs.length; i++) {
        const body: PublishTweetInput = { text: segs[i]! };
        if (i === 0) {
          if (refMode.kind === "reply") body.replyToTweetId = refMode.id;
          if (refMode.kind === "quote") body.quoteTweetId = refMode.id;
        } else {
          body.replyToTweetId = prevId;
        }
        try {
          const res = await xApi.publish(body);
          prevId = res.id;
          posted += 1;
        } catch (err) {
          const detail =
            segs.length > 1 ? ` (${posted}/${segs.length} posted before this failed)` : "";
          const base = err instanceof ApiError ? err.message : "Failed to publish.";
          throw new Error(`${base}${detail}`);
        }
      }
      return { posted };
    },
    onSuccess: ({ posted }) => {
      resetComposer();
      setFeedback({
        kind: "success",
        message: posted > 1 ? `Thread published (${posted} tweets).` : "Tweet published.",
      });
      queryClient.invalidateQueries({ queryKey: ["x-tweets"] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Failed to publish tweet.";
      setFeedback({ kind: "error", message });
    },
  });

  const publishDisabled = empty || anyTooLong || publish.isPending;
  const scheduleDisabled = empty || anyTooLong;

  // ── Reply / quote reference ─────────────────────────────────────
  function attachReference(kind: "reply" | "quote") {
    const id = extractTweetId(refInput);
    if (!id) {
      setRefError("Couldn't read a tweet id from that input. Paste a status URL or numeric id.");
      return;
    }
    setRefError(null);
    setRefMode({ kind, id, raw: refInput.trim() });
    setShowRefs(false);
  }

  function clearReference() {
    setRefMode({ kind: "none" });
    setRefInput("");
    setRefError(null);
  }

  // ── Scheduler props (only consumed in schedule mode) ────────────
  const schedulerSource = useMemo(
    () => ({
      sourceType: (draftId ? "draft" : "ad_hoc") as ScheduleSourceType,
      ...(draftId ? { sourceRef: draftId } : {}),
      sourceTextHash: sourceTextHash(combinedText),
    }),
    [draftId, combinedText],
  );

  const scheduleTitle = useMemo(() => {
    const first = segments[0]?.text.trim().split(/\r?\n/).find((l) => l.trim().length > 0);
    return first ? first.slice(0, 120).trim() : undefined;
  }, [segments]);

  const schedulerChannels = useMemo(() => {
    const trimmed = segments.map((s) => s.text.trim()).filter(Boolean);
    const channelOptions: Record<string, unknown> = {};
    if (refMode.kind === "reply") channelOptions.replyToTweetId = refMode.id;
    if (refMode.kind === "quote") channelOptions.quoteTweetId = refMode.id;
    return [
      {
        channel: "x",
        payload: {
          text: trimmed[0] ?? "",
          // threadParts drives the scheduler's X publisher (posts each
          // part sequentially). Only set it for an actual thread.
          ...(trimmed.length > 1 ? { threadParts: trimmed } : {}),
          ...(Object.keys(channelOptions).length > 0 ? { channelOptions } : {}),
        },
      },
    ];
  }, [segments, refMode]);

  function handleScheduled() {
    queryClient.invalidateQueries({ queryKey: ["scheduler:items"] });
    resetComposer();
  }

  // ── Command palette ─────────────────────────────────────────────
  const commands = useMemo<ComposerCommand[]>(
    () => [
      {
        id: "ai-compose",
        label: "Compose with AI",
        hint: "Generate a fresh tweet from your brand voice",
        group: "AI",
        icon: Sparkles,
        run: () => void handleAiAction({ op: "compose", text: activeText, platform: "x" }),
      },
      {
        id: "ai-redraft",
        label: "Rewrite this tweet",
        group: "AI",
        icon: Wand2,
        disabled: activeText.trim().length === 0,
        run: () => void handleAiAction({ op: "redraft", text: activeText, platform: "x" }),
      },
      {
        id: "add-tweet",
        label: "Add to thread",
        hint: "Append another tweet",
        group: "Compose",
        icon: Plus,
        run: addSegment,
      },
      {
        id: "schedule",
        label: "Schedule for later",
        group: "Publish",
        icon: CalendarClock,
        disabled: scheduleDisabled,
        run: () => setMode("schedule"),
      },
      {
        id: "reply-quote",
        label: refMode.kind === "none" ? "Reply to / quote a tweet" : "Reference attached",
        group: "Compose",
        icon: Reply,
        disabled: refMode.kind !== "none",
        run: () => setShowRefs(true),
      },
    ],
    [handleAiAction, activeText, scheduleDisabled, refMode.kind, addSegment],
  );

  // ── Schedule view ───────────────────────────────────────────────
  if (mode === "schedule") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 border-b pb-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarClock className="size-4 text-primary" />
            Schedule this {isThread ? "thread" : "tweet"}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMode("compose")} className="gap-1.5">
            <ArrowLeft className="size-3.5" /> Back to editing
          </Button>
        </div>
        <SchedulerComposer
          key={schedulerSource.sourceTextHash}
          source={schedulerSource}
          title={scheduleTitle}
          channels={schedulerChannels}
          onScheduled={handleScheduled}
        />
      </div>
    );
  }

  // ── Compose view ────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Voice chip + actions */}
      <div className="flex items-center justify-between gap-2">
        <VoiceCardPreview voiceCard={voiceSummary} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setPaletteOpen(true)}
          className="gap-1.5 text-xs text-muted-foreground"
        >
          <CommandIcon className="size-3.5" /> Actions
        </Button>
      </div>

      {/* Reply/quote reference chip */}
      {refMode.kind !== "none" && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          {refMode.kind === "reply" ? <Reply className="size-4" /> : <Quote className="size-4" />}
          <span className="text-muted-foreground">
            {refMode.kind === "reply" ? "Replying to" : "Quoting"}
          </span>
          <span className="truncate font-mono text-xs">{refMode.raw}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-2"
            onClick={clearReference}
            aria-label="Remove reference"
          >
            <XIcon className="size-3" />
          </Button>
        </div>
      )}

      <AiComposeToolbar text={activeText} platform="x" onAiAction={handleAiAction} />

      {/* Thread segments */}
      <div className="space-y-3">
        {segments.map((seg, index) => {
          const isActive = seg.id === activeId;
          return (
            <div
              key={seg.id}
              ref={(el) => {
                wrapRefs.current.set(seg.id, el);
              }}
              className={cn(
                "relative rounded-md border p-2 transition-colors",
                isActive ? "border-primary/40 bg-card" : "border-border bg-muted/20",
              )}
            >
              {isThread && (
                <div className="mb-1 flex items-center justify-between px-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {index === 0 ? "Tweet 1 (root)" : `Tweet ${index + 1}`}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-muted-foreground hover:text-destructive"
                    onClick={() => removeSegment(seg.id)}
                    aria-label={`Remove tweet ${index + 1}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )}
              <Textarea
                ref={(el) => {
                  textareaRefs.current.set(seg.id, el);
                }}
                value={seg.text}
                onChange={(e) => {
                  updateSegment(seg.id, e.target.value);
                  captureCaret(seg.id, e.target);
                }}
                onSelect={(e) => captureCaret(seg.id, e.currentTarget)}
                onClick={(e) => captureCaret(seg.id, e.currentTarget)}
                onKeyUp={(e) => captureCaret(seg.id, e.currentTarget)}
                onFocus={(e) => captureCaret(seg.id, e.currentTarget)}
                // Capture caret on blur so an emoji/AI insert (which blurs
                // the textarea) lands at the right spot.
                onBlur={(e) => captureCaret(seg.id, e.currentTarget)}
                placeholder={index === 0 ? "What's happening?" : "Continue the thread…"}
                rows={index === 0 ? 4 : 3}
                className="resize-none border-0 bg-transparent p-1 shadow-none focus-visible:ring-0"
                aria-label={isThread ? `Tweet ${index + 1} text` : "Tweet text"}
              />
              <div className="flex items-center justify-end px-1">
                <PlatformCharCounter value={seg.text} platform="x" size="sm" showCount />
              </div>
            </div>
          );
        })}

        {/* Hashtag typeahead anchored to the ACTIVE segment. */}
        <HashtagSuggest
          containerRef={activeWrapRef}
          targetRef={activeTextareaRef}
          text={activeText}
          caret={caret}
          onChange={(next) => updateSegment(activeId, next)}
          onSearch={searchHashtags}
          validateTag={isValidXHashtag}
          minQueryLength={2}
        />
      </div>

      {/* Reply/quote input (toggle) */}
      {showRefs && refMode.kind === "none" && (
        <div className="space-y-2 rounded-md border p-3">
          <Label htmlFor="x-ref-input" className="text-xs uppercase tracking-wide text-muted-foreground">
            Reply to / quote a tweet
          </Label>
          <Input
            id="x-ref-input"
            value={refInput}
            onChange={(e) => setRefInput(e.target.value)}
            placeholder="https://x.com/user/status/123..."
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => attachReference("reply")} disabled={!refInput}>
              <Reply className="mr-1 size-3.5" /> Reply
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => attachReference("quote")} disabled={!refInput}>
              <Quote className="mr-1 size-3.5" /> Quote
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setShowRefs(false); setRefInput(""); setRefError(null); }}>
              Cancel
            </Button>
          </div>
          {refError && <p className="text-xs text-destructive">{refError}</p>}
        </div>
      )}

      {/* Toolbar row: emoji, add-tweet, reply/quote, draft status */}
      <div className="flex flex-wrap items-center gap-2">
        <EmojiPickerTrigger onInsert={insertSnippet} />
        <Button type="button" variant="ghost" size="sm" onClick={addSegment} className="h-7 gap-1.5 px-2 text-xs">
          <Plus className="size-3.5" /> Add tweet
        </Button>
        {refMode.kind === "none" && !showRefs && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowRefs(true)} className="h-7 gap-1.5 px-2 text-xs">
            <Reply className="size-3.5" /> Reply / quote
          </Button>
        )}
        <DraftSaver
          status={draftStatus}
          lastSavedAt={lastSavedAt}
          lastError={draftError}
          onRetry={saveNow}
          className="ml-auto"
        />
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-end gap-2 border-t pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setMode("schedule")}
          disabled={scheduleDisabled}
          className="gap-1.5"
        >
          <CalendarClock className="size-4" /> Schedule
        </Button>
        <Button onClick={() => publish.mutate()} disabled={publishDisabled} aria-busy={publish.isPending} className="gap-1.5">
          {publish.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {publish.isPending ? "Publishing…" : isThread ? "Publish thread" : "Publish"}
        </Button>
      </div>

      {feedback && (
        <p
          role="status"
          className={
            feedback.kind === "error"
              ? "rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              : "rounded-md border border-green-200 bg-green-50/60 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
          }
        >
          {feedback.message}
        </p>
      )}

      <ComposerCommandPalette
        paletteId="x-composer"
        commands={commands}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        placeholder="Compose, schedule, add to thread…"
      />
    </div>
  );
}
