"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Link2 } from "lucide-react";
import { linkedInContentApi, type HookVariant, type LinkedInAuthor, type LinkedInVisibility, type LinkedInIdentity, type PublishLinkedInPostInput, type CarouselPreviewInput, type CarouselPreviewResult, type RewriteHookResponse } from "@/lib/api/linkedin-content";
import { emptyPoll, isPollValid, type PollState } from "./poll-editor";
import { buildCommentarySegments, type ResolvedMention } from "./commentary-segments";
import { ApiError } from "@/lib/api";
import { rewriteContent, createDraft, updateDraft, type ComposerDraftRef } from "@/lib/api/content";
import { insertAtCaret } from "@/lib/composer/caret";
import {
  applyHookVariant,
  authorFromKey,
  buildAuthorOptions,
  buildPublishBody,
  buildScheduleChannels,
  composerGates,
  effectiveVisibilityFor,
  isOrgAuthorKey,
  scheduleTitleFor,
} from "@/lib/linkedin-composer";
import { AiComposeToolbar, ComposerShell, DraftSaver, EmojiPickerTrigger, HashtagSuggest, MentionTypeahead, PlatformCharCounter, useDraftSaver, type AiActionContext, type ComposerCommand, type HashtagCandidate, type MentionCandidate } from "@/components/composer";
import type { ScheduleSourceType } from "@/lib/scheduler/types";
import { sourceTextHash } from "@/lib/scheduler/source-hash";
import { aiOpNoChangeMessage, aiOpToast, isProbablyUrl, mapVoiceCardSummary } from "./composer-helpers";
import { usePolicyCheck } from "./composer-policy-check";
import { HOOK_SCORE_MIN_CHARS, HookScoreCard, useHookScore } from "./composer-hook-score";
import { LinkAttachCard, MentionsStrip } from "./composer-attachments";
import { ComposerActions } from "./composer-actions";
import { buildComposerCommands } from "./composer-commands";
import { ComposerHeader } from "./composer-header";
import { OffBrandVoiceNotice, VoiceCardPanel } from "./composer-voice-card";

// Interaction-gated pieces: each mounts only after the user opens it.
const CarouselPreviewDialog = dynamic(() => import("./carousel-preview-dialog").then((m) => m.CarouselPreviewDialog), { ssr: false });
const PollEditor = dynamic(() => import("./poll-editor").then((m) => m.PollEditor), { ssr: false });
const HookVariantsPanel = dynamic(() => import("./composer-hook-score").then((m) => m.HookVariantsPanel), { ssr: false });
const SchedulerComposer = dynamic(() => import("@/components/scheduler/scheduler-composer").then((m) => m.SchedulerComposer), { ssr: false });
const ComposerCommandPalette = dynamic(() => import("@/components/composer/composer-command-palette").then((m) => m.ComposerCommandPalette), { ssr: false });

interface Props {
  identity: LinkedInIdentity;
  /** When set to a non-empty string, the composer loads it as the
   *  current text. Used by the Suggested Drafts panel above the
   *  composer to populate "Use this draft." The composer only seeds on
   *  *value change* (tracked via a ref) so re-renders with the same
   *  string don't blow away user edits. Empty/undefined values are
   *  ignored entirely. */
  seedText?: string;
}

/** Compose vs. schedule view of the same composer. "schedule" mounts
 *  <SchedulerComposer/> with the current draft as the payload; "compose"
 *  is the default editing surface. */
type ComposerMode = "compose" | "schedule";

export function PostComposer({ identity, seedText }: Props) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [caret, setCaret] = useState(0);
  const [mode, setMode] = useState<ComposerMode>("compose");
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Composer draft id — reactive (feeds the scheduler source) + set by
  // the auto-saver after the first create. Declared up here so the
  // seed effect can reset it on a new composition.
  const [draftId, setDraftId] = useState<string | null>(null);
  const createInFlightRef = useRef<Promise<ComposerDraftRef> | null>(null);

  // textareaRef: the host's controlled textarea. HashtagSuggest reads
  // its live selection (the textarea keeps focus during hashtag pick);
  // emoji + AI inserts route through insertSnippet() instead, using the
  // tracked caret (which survives the popover/toolbar stealing focus).
  // composerWrapRef anchors the hashtag popover.
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerWrapRef = useRef<HTMLDivElement>(null);

  // Mirror text + caret into refs so the ASYNC AI insert handler
  // (handleAiAction awaits a network roundtrip before splicing) reads
  // the live values, not the stale closure it was created with. Synced
  // from state after every render — the AI roundtrip far outlasts a
  // render, and emoji insert reads them after the on-blur caret capture
  // has already committed.
  const textRef = useRef("");
  const caretRef = useRef(0);
  useEffect(() => {
    textRef.current = text;
  }, [text]);
  useEffect(() => {
    caretRef.current = caret;
  }, [caret]);

  // Seed the composer when the parent passes a fresh seedText (e.g.,
  // the user clicked "Use this draft" on the Suggested Drafts panel).
  // A ref tracks the last seed we applied so we don't overwrite the
  // user's in-progress edits on every parent re-render.
  const lastSeedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (seedText && seedText !== lastSeedRef.current) {
      lastSeedRef.current = seedText;
      setText(seedText);
      // A seeded draft is a NEW composition — drop any prior draft id so
      // the next auto-save creates a fresh cnt_drafts row rather than
      // overwriting the one the user just navigated away from. Also clear
      // recorded mentions so a stale URN can't ride along on the new text.
      setDraftId(null);
      setMentions([]);
    }
  }, [seedText]);
  const [visibility, setVisibility] = useState<LinkedInVisibility>("PUBLIC");
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  // Poll (CMA D5). null = no poll. A poll is an exclusive content block, so
  // turning it on clears the link, and carousel/schedule are disabled while it
  // is active (the carousel + scheduler paths don't carry a poll).
  const [poll, setPoll] = useState<PollState | null>(null);
  // Org @mentions (CMA D4) the user inserted via the typeahead, deduped by URN.
  // The inserted `@<name>` text alone can't carry the URN, so we record it here
  // and serialize text → commentarySegments on publish.
  const [mentions, setMentions] = useState<ResolvedMention[]>([]);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  // Author picker — discriminated union string keys for the Select.
  // "org:<id>" → that org page. "person" → user's personal feed. The option
  // rules live in lib/linkedin-composer.ts.
  const authorOptions = useMemo(() => buildAuthorOptions(identity), [identity]);

  const [authorKey, setAuthorKey] = useState<string>(authorOptions[0]?.value ?? "person");

  // Clamp the selected author back into the option list when identity
  // shifts beneath us (scope reconnect drops org_social, page list
  // shrinks, etc). Without this, Radix Select renders a controlled
  // value with no matching item — blank trigger + console warning —
  // and submit would happily ship a stale `org:<id>` to a page the
  // user can no longer post to.
  useEffect(() => {
    if (!authorOptions.some((o) => o.value === authorKey)) {
      setAuthorKey(authorOptions[0]?.value ?? "person");
    }
  }, [authorOptions, authorKey]);

  // LinkedIn rejects non-PUBLIC visibility on org posts. Coerce to
  // PUBLIC when the user picks a page so the submit doesn't surface
  // the raw API error. Keeps the visibility selector simple — both
  // org and person flows share the same control state.
  const isOrgAuthor = isOrgAuthorKey(authorKey);
  const effectiveVisibility: LinkedInVisibility = effectiveVisibilityFor(authorKey, visibility);
  const authorType: "person" | "org" = isOrgAuthor ? "org" : "person";

  // Hook DNA score — debounced live scoring as the user types.
  const hookScore = useHookScore(text);

  // Advisory content-policy pre-check — debounced; advisory only (the
  // hard gate still runs server-side at publish).
  const policy = usePolicyCheck(text, authorType);

  // Voice card — shared cache key with <VoiceCardPanel/> below (React
  // Query dedupes the fetch), mapped to the compact preview chip shape.
  const voiceCardQuery = useQuery({
    queryKey: ["linkedin-voice-card"],
    queryFn: () => linkedInContentApi.voiceCard(),
    retry: (failureCount, err) => {
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 5 * 60_000,
  });
  const voiceSummary = useMemo(
    () => mapVoiceCardSummary(voiceCardQuery.data),
    [voiceCardQuery.data],
  );

  // Rewrite-hook variants — explicit user action (NOT debounced)
  // because each call is an LLM roundtrip with real cost.
  const [variants, setVariants] = useState<RewriteHookResponse | null>(null);
  const rewrite = useMutation({
    mutationFn: () => linkedInContentApi.rewriteHook(text.trim(), 4),
    onSuccess: setVariants,
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : "Couldn't rewrite hook.";
      setFeedback({ kind: "error", message });
    },
  });

  function applyVariant(v: HookVariant) {
    const next = applyHookVariant(text, v.hook);
    setText(next);
    pruneMentions(next);
    setVariants(null);
  }

  // ── Composer draft auto-save ────────────────────────────────────
  // The create-in-flight ref (declared with draftId near the top)
  // serialises the FIRST save so two rapid saves can't create two
  // cnt_drafts rows before the first POST returns.
  const saveDraft = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (trimmed.length === 0) return; // never persist an empty draft

      if (draftId) {
        await updateDraft(draftId, { text: value });
        return;
      }
      // A create is already running (rapid second save) — wait for it,
      // then update the row it produced rather than creating another.
      if (createInFlightRef.current) {
        const ref = await createInFlightRef.current;
        await updateDraft(ref.draftId, { text: value });
        return;
      }
      const p = createDraft({ text: value, channel: "linkedin" });
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
    // Suspend auto-save while empty (null) so we don't create blank rows.
    value: text.trim().length > 0 ? text : null,
    save: saveDraft,
  });

  const publish = useMutation({
    mutationFn: (input: PublishLinkedInPostInput) => linkedInContentApi.publish(input),
    onSuccess: () => {
      resetComposer();
      setFeedback({ kind: "success", message: "Post published to LinkedIn." });
      queryClient.invalidateQueries({ queryKey: ["linkedin-me"] });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : "Failed to publish post.";
      setFeedback({ kind: "error", message });
    },
  });

  // Carousel — repurpose the composer text into a swipeable LinkedIn document
  // post (one AI-rendered slide per section). Long-running (~30–60s): the
  // button shows a patient pending state while the server renders slides.
  // STEP 1 — generate a preview (server renders slides + a PDF and stashes it;
  // NO LinkedIn call). On success we open the review dialog; the user approves
  // and publishes from there (step 2). `carouselPreview` non-null = dialog open.
  const [carouselPreview, setCarouselPreview] = useState<CarouselPreviewResult | null>(null);
  // Publish target snapshotted at preview time so a later author/visibility
  // change can't silently retarget the generated post.
  const [carouselTarget, setCarouselTarget] = useState<{
    author: LinkedInAuthor;
    visibility: LinkedInVisibility;
    label: string;
  } | null>(null);
  const carousel = useMutation({
    mutationFn: (input: CarouselPreviewInput) => linkedInContentApi.previewCarousel(input),
    onSuccess: (res) => setCarouselPreview(res),
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : "Couldn't build the carousel preview.";
      setFeedback({ kind: "error", message });
    },
  });

  /** Clear all composition state after a successful publish/schedule.
   *  Resets draftId so the next post starts a fresh cnt_drafts row. */
  function resetComposer() {
    setText("");
    setCaret(0);
    caretRef.current = 0;
    textRef.current = "";
    setLinkUrl("");
    setLinkTitle("");
    setShowLink(false);
    setPoll(null);
    setMentions([]);
    setVariants(null);
    setDraftId(null);
    setMode("compose");
  }

  /** Toggle the poll editor. Turning it on clears the link (a poll is an
   *  exclusive content block); clearing the link on toggle-off is a harmless
   *  no-op (the link affordance is hidden while a poll is active). All four
   *  setters batch in the one event tick — no nested-updater impurity. */
  const togglePoll = useCallback(() => {
    setPoll((prev) => (prev ? null : emptyPoll()));
    setShowLink(false);
    setLinkUrl("");
    setLinkTitle("");
  }, []);

  const anyPending = publish.isPending || carousel.isPending;
  const pollActive = poll !== null;
  const {
    empty,
    linkInvalid,
    publishDisabled,
    scheduleDisabled,
    carouselTooShort,
    carouselDisabled,
  } = composerGates({
    text,
    showLink,
    linkUrl,
    pollActive,
    pollValid: poll !== null && isPollValid(poll),
    anyPending,
    linkLooksLikeUrl: isProbablyUrl(linkUrl),
  });

  function onSubmit() {
    if (publishDisabled) return;
    setFeedback(null);

    // Poll posts use the raw path — a poll's intro text isn't segmented here.
    const segments = poll ? null : buildCommentarySegments(text.trim(), mentions);
    const body = buildPublishBody({
      authorKey,
      visibility,
      text,
      segments,
      poll,
      showLink,
      linkUrl,
      linkTitle,
    });

    publish.mutate(body);
  }

  function onCarousel() {
    if (carouselDisabled) return;
    setFeedback(null);
    // The composer text IS the source the server splits into slides. Snapshot
    // the publish target NOW (the dialog shows + uses it) so changing the
    // picker during the ~30–60s preview can't retarget the post.
    const author: LinkedInAuthor = authorFromKey(authorKey);
    const label = authorOptions.find((o) => o.value === authorKey)?.label ?? "your feed";
    setCarouselTarget({ author, visibility: effectiveVisibility, label });
    carousel.mutate({ newsletterText: text.trim() });
  }

  // ── Caret-aware snippet insertion ───────────────────────────────
  // The ONE path every insert takes (emoji glyph, AI pull-quote, AI
  // disclosure): splice at the tracked caret via the shared pure
  // helper, sync state + refs, drop any stale hook variants (the body
  // changed), and restore focus + selection just past the snippet so
  // the user can keep typing. Reads caret/text from refs so it's safe
  // to call from the async AI handler. Returns the new full text for
  // callers that want it (the toolbar's onAiAction contract).
  const insertSnippet = useCallback((snippet: string): string => {
    const { text: next, caret: nextCaret } = insertAtCaret(
      textRef.current,
      caretRef.current,
      snippet,
    );
    setText(next);
    setCaret(nextCaret);
    textRef.current = next;
    caretRef.current = nextCaret;
    setVariants(null); // stale once the body changed
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      // focus() before setSelectionRange — iOS Safari occasionally
      // drops the selection if the order is reversed.
      el.focus();
      el.setSelectionRange(nextCaret, nextCaret);
    });
    return next;
  }, []);

  // ── AI compose toolbar handler ──────────────────────────────────
  // Drop recorded mentions whose `@<name>` token no longer resolves in the text
  // (e.g. after an AI redraft / variant-apply replaced the body). Uses the same
  // boundary-aware serializer as publish, so a name that's merely a prefix of
  // another retained mention isn't kept by a naive substring check.
  const pruneMentions = useCallback((nextText: string) => {
    setMentions((prev) =>
      prev.filter((m) => buildCommentarySegments(nextText, [m]) !== null),
    );
  }, []);

  const handleAiAction = useCallback(
    async (ctx: AiActionContext): Promise<string> => {
      const res = await rewriteContent({
        op: ctx.op,
        text: ctx.text,
        platform: "linkedin",
        ...(ctx.extras ? { extras: ctx.extras } : {}),
      });
      // Insert ops (quote / disclosure) return a SNIPPET to splice at
      // the caret. `insert` is optional on the wire — an API that
      // predates the snippet contract omits it, so we check `=== true`
      // (not truthy-on-undefined) and keep the legacy full-body replace
      // as the safe default rather than wiping the draft with a snippet.
      let newText: string;
      if (res.insert === true) {
        newText = insertSnippet(res.text);
      } else {
        newText = res.text;
        // ★A replace op that hands back the draft it was given is a no-op,
        // and a green "Draft shortened." over a box the user cannot see
        // move is exactly what was reported as "it says it's working and
        // it doesn't do anything". Name it, and leave the draft alone —
        // swapping identical text would still drop the user's @mentions
        // and hook variants for nothing.
        if (newText.trim() === ctx.text.trim()) {
          toast.message(aiOpNoChangeMessage(ctx.op));
          return newText;
        }
        setText(newText);
        pruneMentions(newText); // a full-body replace can drop @mention tokens
        setVariants(null); // stale once the body changed
      }
      const { message, success } = aiOpToast(ctx.op, ctx.text, newText);
      // Neutral, not green, when the op did not do what its button says —
      // matching the no-change case above rather than dressing a miss as a
      // win.
      if (success) toast.success(message);
      else toast.message(message);
      return newText;
    },
    [insertSnippet, pruneMentions],
  );

  // No-op hashtag search — LinkedIn has no hashtag-history endpoint yet,
  // so the typeahead surfaces only the inline "Create #tag" affordance.
  // We rely on the primitive's generic default validator (letters/
  // digits/underscore, min 2 chars), which happens to match LinkedIn's
  // tag rules; mounted with minQueryLength={2} so a single-char "#a"
  // doesn't flash an empty "No matches" popover before the Create row
  // qualifies. Swaps to a real source when a hashtag endpoint ships.
  const searchHashtags = useCallback(
    async (): Promise<HashtagCandidate[]> => [],
    [],
  );

  // Org @mention typeahead (CMA D4). org-lookup is an EXACT vanity-handle
  // resolver (people search is closed), so a match surfaces once the user has
  // typed the full handle. The candidate's `handle` is the org's display name —
  // that's the text inserted as `@<name>` AND the text LinkedIn must match to
  // render the mention. `id` carries the org URN for the mention segment.
  const searchMentions = useCallback(
    async (query: string, signal: AbortSignal): Promise<MentionCandidate[]> => {
      try {
        const { organizations } = await linkedInContentApi.orgLookup(query);
        if (signal.aborted) return [];
        return organizations.map((o) => ({
          id: o.urn,
          handle: o.name,
          displayName: o.name,
        }));
      } catch {
        // 403 / not-connected / network — surface no matches, never an error.
        return [];
      }
    },
    [],
  );

  // Record a picked org so publish can resolve its `@<name>` token → a mention
  // segment with the URN. Dedupe by URN (the same org may be mentioned twice).
  const handlePickMention = useCallback((c: MentionCandidate) => {
    setMentions((prev) =>
      prev.some((m) => m.urn === c.id) ? prev : [...prev, { name: c.handle, urn: c.id }],
    );
  }, []);

  function updateCaret(e: { currentTarget: HTMLTextAreaElement }) {
    setCaret(e.currentTarget.selectionStart ?? 0);
  }

  // ── Scheduler props (only consumed in schedule mode) ────────────
  const scheduleTitle = useMemo(() => scheduleTitleFor(text), [text]);

  const schedulerSource = useMemo(
    () => ({
      sourceType: (draftId ? "draft" : "ad_hoc") as ScheduleSourceType,
      ...(draftId ? { sourceRef: draftId } : {}),
      sourceTextHash: sourceTextHash(text),
    }),
    [draftId, text],
  );

  const schedulerChannels = useMemo(
    () =>
      buildScheduleChannels({
        authorKey,
        personUrn: identity.person.urn,
        visibility,
        showLink,
        linkUrl,
        linkTitle,
        text,
      }),
    [authorKey, identity.person.urn, visibility, showLink, linkUrl, linkTitle, text],
  );

  function handleScheduled() {
    // SchedulerComposer fires its own "Scheduled across N channels."
    // toast — don't double-toast. Invalidate the calendar query so a
    // parallel tab refreshes, then reset back to a clean composer.
    queryClient.invalidateQueries({ queryKey: ["scheduler:items"] });
    resetComposer();
  }

  // ── Command palette actions ─────────────────────────────────────
  const commands = useMemo<ComposerCommand[]>(
    () =>
      buildComposerCommands({
        text,
        empty,
        scheduleDisabled,
        showLink,
        pollActive,
        runAi: handleAiAction,
        onSchedule: () => setMode("schedule"),
        onAttachLink: () => setShowLink(true),
        onTogglePoll: togglePoll,
      }),
    [handleAiAction, text, empty, scheduleDisabled, showLink, pollActive, togglePoll],
  );

  // ── Schedule view ───────────────────────────────────────────────
  // Early return is AFTER all hooks above — safe. Guarded on !pollActive:
  // the scheduler payload carries no poll, so a poll must never reach this
  // branch (every entry into schedule mode is already gated on pollActive —
  // this is belt-and-suspenders so a future entry point can't silently
  // schedule a poll as plain text).
  if (mode === "schedule" && !pollActive) {
    return (
      <ComposerShell
        mode="schedule"
        scheduleView={{
          noun: "post",
          onBack: () => setMode("compose"),
          scheduler: (
            <SchedulerComposer
              key={schedulerSource.sourceTextHash}
              source={schedulerSource}
              title={scheduleTitle}
              channels={schedulerChannels}
              onScheduled={handleScheduled}
            />
          ),
        }}
      />
    );
  }

  return (
    <ComposerShell
      mode="compose"
      voiceCard={voiceSummary}
      onOpenPalette={() => setPaletteOpen(true)}
      headerSlot={
        <ComposerHeader
          identity={identity}
          authorOptions={authorOptions}
          authorKey={authorKey}
          onAuthorChange={setAuthorKey}
          effectiveVisibility={effectiveVisibility}
          onVisibilityChange={setVisibility}
          isOrgAuthor={isOrgAuthor}
        />
      }
      subHeaderSlot={
        <>
          <OffBrandVoiceNotice authorKey={authorKey} />
          <VoiceCardPanel />
        </>
      }
      toolbarSlot={<AiComposeToolbar text={text} platform="linkedin" onAiAction={handleAiAction} />}
      statusSlot={
        <>
          <PlatformCharCounter platform="linkedin" value={text} />
          <DraftSaver
            status={draftStatus}
            lastSavedAt={lastSavedAt}
            lastError={draftError}
            onRetry={saveNow}
          />
        </>
      }
      actionsSlot={
        <ComposerActions
          policy={policy}
          pollActive={pollActive}
          scheduleDisabled={scheduleDisabled}
          onSchedule={() => setMode("schedule")}
          onTogglePoll={togglePoll}
          carouselDisabled={carouselDisabled}
          carouselTooShort={carouselTooShort}
          carouselPending={carousel.isPending}
          onCarousel={onCarousel}
          publishDisabled={publishDisabled}
          publishPending={publish.isPending}
          onPublish={onSubmit}
        />
      }
      footerSlot={
        feedback ? (
          <p
            role="status"
            className={
              feedback.kind === "error"
                ? "rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                : "rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success-on-tint"
            }
          >
            {feedback.message}
          </p>
        ) : undefined
      }
      paletteSlot={
        <ComposerCommandPalette
          paletteId="linkedin-composer"
          commands={commands}
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
        />
      }
    >
      <div ref={composerWrapRef} className="relative">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
            // Stale-variant guard — a typing user has moved on from the
            // hook the rewrites were generated for.
            if (variants !== null) setVariants(null);
          }}
          onSelect={updateCaret}
          onClick={updateCaret}
          onKeyUp={updateCaret}
          // Capture the caret on blur too — clicking the emoji trigger
          // or an AI insert button blurs the textarea, and selectionStart
          // still holds the last position at blur time. Without this the
          // insert lands at the end/0 (the original emoji bug).
          onBlur={updateCaret}
          placeholder="Share an update, story, or question…"
          rows={6}
          className="resize-none"
          aria-label="LinkedIn post content"
        />
      </div>
      <HashtagSuggest
        containerRef={composerWrapRef}
        targetRef={textareaRef}
        text={text}
        caret={caret}
        onChange={setText}
        onSearch={searchHashtags}
        minQueryLength={2}
      />
      <MentionTypeahead
        containerRef={composerWrapRef}
        targetRef={textareaRef}
        text={text}
        caret={caret}
        onChange={setText}
        onSearch={searchMentions}
        onPick={handlePickMention}
        minQueryLength={2}
      />

      <MentionsStrip
        mentions={mentions}
        onUnlink={(urn) => setMentions((prev) => prev.filter((x) => x.urn !== urn))}
      />

      <div className="flex items-center gap-2">
        <EmojiPickerTrigger onInsert={insertSnippet} />
        {!showLink && !pollActive && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowLink(true)} className="h-7 gap-1.5 px-2 text-xs">
            <Link2 className="size-3.5" /> Add link
          </Button>
        )}
      </div>

      <HookScoreCard
        score={hookScore}
        onRewrite={() => {
          if (text.trim().length < HOOK_SCORE_MIN_CHARS) return;
          setFeedback(null);
          rewrite.mutate();
        }}
        rewritePending={rewrite.isPending}
      />

      {variants && (
        <HookVariantsPanel
          response={variants}
          onPick={applyVariant}
          onDismiss={() => setVariants(null)}
        />
      )}

      {poll && (
        <PollEditor value={poll} onChange={setPoll} onRemove={() => setPoll(null)} />
      )}

      {showLink && (
        <LinkAttachCard
          linkUrl={linkUrl}
          linkTitle={linkTitle}
          linkInvalid={linkInvalid}
          onLinkUrlChange={setLinkUrl}
          onLinkTitleChange={setLinkTitle}
          onRemove={() => {
            setShowLink(false);
            setLinkUrl("");
            setLinkTitle("");
          }}
        />
      )}

      {carouselPreview && carouselTarget && (
        <CarouselPreviewDialog
          preview={carouselPreview}
          author={carouselTarget.author}
          visibility={carouselTarget.visibility}
          targetLabel={carouselTarget.label}
          onClose={() => {
            setCarouselPreview(null);
            setCarouselTarget(null);
          }}
          onPublished={() => {
            setCarouselPreview(null);
            setCarouselTarget(null);
            resetComposer();
            setFeedback({ kind: "success", message: "Carousel published to LinkedIn." });
            queryClient.invalidateQueries({ queryKey: ["linkedin-me"] });
          }}
        />
      )}
    </ComposerShell>
  );
}
