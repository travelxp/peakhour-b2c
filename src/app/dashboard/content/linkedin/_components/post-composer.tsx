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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  Command as CommandIcon,
  Link2,
  Loader2,
  Mic,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import {
  linkedInContentApi,
  type ComposerPolicyAdvisory,
  type HookScore,
  type HookVariant,
  type LinkedInAuthor,
  type LinkedInVisibility,
  type LinkedInIdentity,
  type LinkedInVoiceCard,
  type PublishLinkedInPostInput,
  type RewriteHookResponse,
} from "@/lib/api/linkedin-content";
import { ApiError } from "@/lib/api";
import { rewriteContent, createDraft, updateDraft, type ComposerDraftRef } from "@/lib/api/content";
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
  type RewriteOp,
  type VoiceCardSummary,
} from "@/components/composer";
import { SchedulerComposer } from "@/components/scheduler/scheduler-composer";
import type { ScheduleSourceType } from "@/lib/scheduler/types";
import { cn } from "@/lib/utils";

const MAX_LEN = 3000;

const HAS_ORG_SCOPE = "w_organization_social";

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

  // Refs the caret-aware primitives (emoji insert, hashtag typeahead)
  // read live. composerWrapRef anchors the hashtag popover.
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerWrapRef = useRef<HTMLDivElement>(null);

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
      // overwriting the one the user just navigated away from.
      setDraftId(null);
    }
  }, [seedText]);
  const [visibility, setVisibility] = useState<LinkedInVisibility>("PUBLIC");
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  // Author picker — discriminated union string keys for the Select.
  // "person" → user's personal feed. "org:<id>" → that org page.
  const authorOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string; sublabel?: string }> = [
      {
        value: "person",
        label: identity.person.name ?? "My personal feed",
        sublabel: "Personal feed",
      },
    ];
    const canPostAsOrg = identity.scopes.includes(HAS_ORG_SCOPE);
    if (canPostAsOrg) {
      for (const page of identity.pages) {
        opts.push({
          value: `org:${page.id}`,
          label: page.name || `Page ${page.id}`,
          sublabel: "Company page",
        });
      }
    }
    return opts;
  }, [identity]);

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
  const isOrgAuthor = authorKey.startsWith("org:");
  const effectiveVisibility: LinkedInVisibility = isOrgAuthor ? "PUBLIC" : visibility;
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
    // Replace the hook with the picked variant, preserving any body
    // below the first blank-line boundary.
    const [, ...rest] = text.split(/\n\s*\n/);
    setText(rest.length > 0 ? `${v.hook}\n\n${rest.join("\n\n")}` : v.hook);
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

  /** Clear all composition state after a successful publish/schedule.
   *  Resets draftId so the next post starts a fresh cnt_drafts row. */
  function resetComposer() {
    setText("");
    setLinkUrl("");
    setLinkTitle("");
    setShowLink(false);
    setVariants(null);
    setDraftId(null);
    setMode("compose");
  }

  const remaining = MAX_LEN - text.length;
  const tooLong = remaining < 0;
  const empty = text.trim().length === 0;
  const linkInvalid = showLink && linkUrl.trim().length > 0 && !isProbablyUrl(linkUrl);
  const publishDisabled = empty || tooLong || publish.isPending || linkInvalid;
  const scheduleDisabled = empty || tooLong || linkInvalid;

  function onSubmit() {
    if (publishDisabled) return;
    setFeedback(null);

    const author: LinkedInAuthor = isOrgAuthor
      ? { type: "org", pageId: authorKey.slice("org:".length) }
      : { type: "person" };

    const body: PublishLinkedInPostInput = {
      author,
      commentary: text.trim(),
      visibility: effectiveVisibility,
    };

    if (showLink && linkUrl.trim()) {
      body.link = {
        url: linkUrl.trim(),
        title: linkTitle.trim() || undefined,
      };
    }

    publish.mutate(body);
  }

  // ── AI compose toolbar handler ──────────────────────────────────
  const handleAiAction = useCallback(
    async (ctx: AiActionContext): Promise<string> => {
      const { text: newText } = await rewriteContent({
        op: ctx.op,
        text: ctx.text,
        platform: "linkedin",
        ...(ctx.extras ? { extras: ctx.extras } : {}),
      });
      setText(newText);
      setVariants(null); // stale once the body changed
      toast.success(aiOpToastMessage(ctx.op));
      return newText;
    },
    [],
  );

  // No-op hashtag search — LinkedIn has no hashtag-history endpoint yet,
  // so the typeahead surfaces only the inline "Create #tag" affordance
  // (the primitive's default-valid-tag rule covers LinkedIn's
  // letters/digits/underscore convention). Swaps to a real source when
  // a hashtag endpoint ships.
  const searchHashtags = useCallback(
    async (): Promise<HashtagCandidate[]> => [],
    [],
  );

  function updateCaret(e: { currentTarget: HTMLTextAreaElement }) {
    setCaret(e.currentTarget.selectionStart ?? 0);
  }

  // ── Scheduler props (only consumed in schedule mode) ────────────
  const scheduleTitle = useMemo(() => {
    const firstLine = text.trim().split(/\r?\n/).find((l) => l.trim().length > 0);
    return firstLine ? firstLine.slice(0, 120).trim() : undefined;
  }, [text]);

  const schedulerSource = useMemo(
    () => ({
      sourceType: (draftId ? "draft" : "ad_hoc") as ScheduleSourceType,
      ...(draftId ? { sourceRef: draftId } : {}),
      sourceTextHash: sourceTextHashFor(text),
    }),
    [draftId, text],
  );

  const schedulerChannels = useMemo(() => {
    // channelOptions carries the LinkedIn-specific publish settings the
    // scheduler's linkedin publisher adapter reads (authorUrn /
    // visibility / link) so a scheduled post fires with the SAME author
    // + visibility + link the user picked here.
    const channelOptions: Record<string, unknown> = {
      authorUrn: isOrgAuthor
        ? `urn:li:organization:${authorKey.slice("org:".length)}`
        : identity.person.urn,
      visibility: effectiveVisibility,
    };
    if (showLink && linkUrl.trim()) {
      channelOptions.link = {
        url: linkUrl.trim(),
        ...(linkTitle.trim() ? { title: linkTitle.trim() } : {}),
      };
    }
    return [
      {
        channel: "linkedin",
        payload: { text: text.trim(), channelOptions },
      },
    ];
  }, [
    isOrgAuthor,
    authorKey,
    identity.person.urn,
    effectiveVisibility,
    showLink,
    linkUrl,
    linkTitle,
    text,
  ]);

  function handleScheduled() {
    // SchedulerComposer fires its own "Scheduled across N channels."
    // toast — don't double-toast. Invalidate the calendar query so a
    // parallel tab refreshes, then reset back to a clean composer.
    queryClient.invalidateQueries({ queryKey: ["scheduler:items"] });
    resetComposer();
  }

  // ── Command palette actions ─────────────────────────────────────
  const commands = useMemo<ComposerCommand[]>(
    () => [
      {
        id: "ai-compose",
        label: "Compose with AI",
        hint: "Generate a fresh draft from your brand voice",
        group: "AI",
        icon: Sparkles,
        run: () => {
          void handleAiAction({ op: "compose", text, platform: "linkedin" });
        },
      },
      {
        id: "ai-redraft",
        label: "Rewrite this draft",
        group: "AI",
        icon: Wand2,
        disabled: empty,
        run: () => {
          void handleAiAction({ op: "redraft", text, platform: "linkedin" });
        },
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
        id: "add-link",
        label: showLink ? "Link attached" : "Attach a link",
        group: "Compose",
        icon: Link2,
        disabled: showLink,
        run: () => setShowLink(true),
      },
    ],
    [handleAiAction, text, empty, scheduleDisabled, showLink],
  );

  // ── Schedule view ───────────────────────────────────────────────
  // Early return is AFTER all hooks above — safe.
  if (mode === "schedule") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 border-b pb-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarClock className="size-4 text-primary" />
            Schedule this post
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setMode("compose")}
            className="gap-1.5"
          >
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

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="li-author" className="text-xs uppercase tracking-wide text-muted-foreground">
            Post as
          </Label>
          <Select value={authorKey} onValueChange={setAuthorKey}>
            <SelectTrigger id="li-author">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {authorOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className="flex flex-col">
                    <span>{opt.label}</span>
                    {opt.sublabel && (
                      <span className="text-xs text-muted-foreground">{opt.sublabel}</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!identity.scopes.includes(HAS_ORG_SCOPE) && identity.pages.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Reconnect LinkedIn to enable posting from your company pages.
            </p>
          )}
          {identity.scopes.includes(HAS_ORG_SCOPE) && identity.pages.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No pages enabled.{" "}
              <a
                href="/dashboard/integrations"
                className="font-medium text-primary underline underline-offset-2 hover:no-underline"
              >
                Manage pages
              </a>
              .
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="li-visibility" className="text-xs uppercase tracking-wide text-muted-foreground">
            Visibility
          </Label>
          <Select
            value={effectiveVisibility}
            onValueChange={(v) => setVisibility(v as LinkedInVisibility)}
            disabled={isOrgAuthor}
          >
            <SelectTrigger id="li-visibility">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PUBLIC">Public — anyone on LinkedIn</SelectItem>
              <SelectItem value="CONNECTIONS">Connections only</SelectItem>
              <SelectItem value="LOGGED_IN">Signed-in members</SelectItem>
            </SelectContent>
          </Select>
          {isOrgAuthor && (
            <p className="text-xs text-muted-foreground">
              Company page posts are always public.
            </p>
          )}
        </div>
      </div>

      {/* Voice chip + command palette trigger */}
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

      <VoiceCardPanel />

      <AiComposeToolbar text={text} platform="linkedin" onAiAction={handleAiAction} />

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
      />

      <div className="flex items-center gap-2">
        <EmojiPickerTrigger targetRef={textareaRef} onChange={setText} />
        {!showLink && (
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

      {showLink && (
        <div className="space-y-2 rounded-md border p-3">
          <Label htmlFor="li-link-url" className="text-xs uppercase tracking-wide text-muted-foreground">
            Attach link
          </Label>
          <Input
            id="li-link-url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com/article"
            aria-invalid={linkInvalid}
          />
          <Input
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            placeholder="Link title (optional)"
          />
          <div className="flex items-center justify-between">
            {linkInvalid ? (
              <p className="text-xs text-destructive">Enter a valid http(s) URL.</p>
            ) : (
              <span />
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowLink(false);
                setLinkUrl("");
                setLinkTitle("");
              }}
            >
              <X className="size-3.5 mr-1" /> Remove
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <PlatformCharCounter platform="linkedin" value={text} />
          <DraftSaver
            status={draftStatus}
            lastSavedAt={lastSavedAt}
            lastError={draftError}
            onRetry={saveNow}
          />
        </div>
        <div className="flex items-center gap-2">
          <PolicyChip state={policy} />
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
          <Button onClick={onSubmit} disabled={publishDisabled} aria-busy={publish.isPending}>
            <Send className="size-4 mr-1.5" />
            {publish.isPending ? "Publishing…" : "Publish"}
          </Button>
        </div>
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
        paletteId="linkedin-composer"
        commands={commands}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
      />
    </div>
  );
}

export function PostComposerSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-32 w-full" />
      <div className="flex justify-between">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  );
}

/**
 * Use the linkedin-me query as the data source for the composer's
 * picker. Re-exported here so the page can render the right shell
 * (composer, EmptyState, or Reconnect CTA) based on the same query.
 */
export function useLinkedInIdentity() {
  return useQuery({
    queryKey: ["linkedin-me"],
    queryFn: () => linkedInContentApi.me(),
    retry: (failureCount, err) => {
      if (err instanceof ApiError && (err.code === "NOT_CONNECTED" || err.status === 404)) {
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 60_000,
  });
}

function isProbablyUrl(s: string): boolean {
  try {
    const u = new URL(s.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Map the LinkedIn-specific voice card to the shared
 *  <VoiceCardPreview/> summary shape. Returns null when no card has
 *  been synthesised yet (the preview renders nothing for null). */
function mapVoiceCardSummary(card: LinkedInVoiceCard | undefined): VoiceCardSummary | null {
  if (!card) return null;
  return {
    id: `linkedin-post-v${card.version}`,
    channel: "linkedin",
    category: "post",
    toneAdjectives: card.voice.tone ?? [],
    signaturePhrases: card.voice.signaturePhrases ?? [],
    avoidPhrases: card.voice.avoidPhrases ?? [],
    refreshedAt: card.lastGeneratedAt,
  };
}

/** Human toast copy per AI op. */
function aiOpToastMessage(op: RewriteOp): string {
  switch (op) {
    case "compose":
      return "Draft composed.";
    case "redraft":
      return "Draft rewritten.";
    case "shorten":
      return "Draft shortened.";
    case "lengthen":
      return "Draft expanded.";
    case "tone":
      return "Tone updated.";
    case "quote":
      return "Pull-quote added.";
    case "disclosure":
      return "Disclosure added.";
  }
}

/** Stable, deterministic fingerprint of the composer text for the
 *  scheduler's required sourceTextHash. djb2a — good enough for the
 *  server's plan-dedup; not security-sensitive. */
function sourceTextHashFor(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
  return `li:${(h >>> 0).toString(36)}`;
}

// ── Content-policy advisory pre-check ────────────────────────────────

const POLICY_DEBOUNCE_MS = 800;
const POLICY_MIN_CHARS = 24;

/**
 * Debounced advisory content-policy check. Fires
 * `POST /v1/linkedin/content/check-policy` 800ms after the user stops
 * typing, once there's enough text to be worth classifying.
 *
 * Returns:
 *   - `null`      while text is too short to check
 *   - `undefined` while a debounce/request window is open (pending)
 *   - advisory    otherwise. A 429 (rate-limited) or any error resolves
 *     to a `checked:false` advisory so the chip renders a neutral
 *     "couldn't check" — never a scary error or a false "OK".
 */
function usePolicyCheck(
  text: string,
  authorType: "person" | "org",
): ComposerPolicyAdvisory | null | undefined {
  const trimmed = text.trim();
  const longEnough = trimmed.length >= POLICY_MIN_CHARS;
  // Store only the async result tagged with the text it was computed
  // for. The null (too-short) and undefined (pending) states are
  // DERIVED below from the current text — no synchronous setState in
  // the effect (avoids cascading renders), and the chip flips to
  // "pending" the instant the text changes past the last checked value.
  const [res, setRes] = useState<{ forText: string; advisory: ComposerPolicyAdvisory } | null>(null);

  useEffect(() => {
    if (!longEnough) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      linkedInContentApi
        .checkPolicy(trimmed, authorType)
        .then((advisory) => {
          if (!cancelled) setRes({ forText: trimmed, advisory });
        })
        .catch(() => {
          // 429 / network / soft-fail — treat as "couldn't check".
          if (!cancelled) {
            setRes({
              forText: trimmed,
              advisory: { overall: "ok", summary: "", findings: [], issueCount: 0, checked: false },
            });
          }
        });
    }, POLICY_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [trimmed, longEnough, authorType]);

  if (!longEnough) return null;
  if (!res || res.forText !== trimmed) return undefined; // pending: no fresh result for current text
  return res.advisory;
}

/**
 * Advisory policy chip rendered near Publish. Non-blocking — the hard
 * gate still runs server-side at publish. States:
 *   - hidden while too-short (null)
 *   - "Checking…" while pending (undefined)
 *   - "Policy: OK" when clean
 *   - "Policy: N issue(s)" with a hover popover of findings
 *   - "Couldn't check" (neutral) when the gate soft-failed / was rate-limited
 */
function PolicyChip({ state }: { state: ComposerPolicyAdvisory | null | undefined }) {
  if (state === null) return null;
  if (state === undefined) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
        Checking policy…
      </span>
    );
  }

  if (!state.checked) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
        title="We couldn't run the policy check just now — it doesn't block publishing."
      >
        <Shield className="size-3.5" />
        Policy check unavailable
      </span>
    );
  }

  if (state.overall === "ok") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
        <ShieldCheck className="size-3.5" />
        Policy: OK
      </span>
    );
  }

  const issues = state.findings.filter((f) => f.verdict !== "ok");
  const tone =
    state.overall === "block"
      ? "text-destructive"
      : "text-amber-700 dark:text-amber-400";
  return (
    <HoverCard openDelay={150} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            tone,
          )}
          aria-label={`Content policy: ${state.issueCount} issue${state.issueCount === 1 ? "" : "s"}. Hover for details.`}
        >
          <ShieldAlert className="size-3.5" />
          Policy: {state.issueCount} issue{state.issueCount === 1 ? "" : "s"}
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="end" side="top" className="w-80">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className={cn("size-4", tone)} />
          {state.overall === "block" ? "Likely policy violation" : "Possible policy issues"}
        </div>
        {state.summary && (
          <p className="mt-1 text-xs text-muted-foreground">{state.summary}</p>
        )}
        <ul className="mt-2 space-y-1.5">
          {issues.map((f, i) => (
            <li key={`${f.category}-${i}`} className="text-xs">
              <span
                className={cn(
                  "mr-1.5 rounded-sm px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                  f.verdict === "block"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                )}
              >
                {f.category.replace(/_/g, " ")}
              </span>
              {f.rationale}
            </li>
          ))}
        </ul>
        <p className="mt-2 border-t pt-2 text-[10px] text-muted-foreground">
          Advisory only — you can still publish. The same check runs when you post.
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}

// ── Hook DNA scoring ─────────────────────────────────────────────────

const HOOK_SCORE_DEBOUNCE_MS = 400;
const HOOK_SCORE_MIN_CHARS = 8;

/**
 * Debounced hook scorer. Fires `POST /v1/linkedin/content/score-hook`
 * 400ms after the user stops typing. Pure-server function (no AI),
 * so the cost of getting it wrong is just a request, not a token bill.
 */
function useHookScore(text: string): HookScore | null | undefined {
  const trimmed = text.trim();
  const longEnough = trimmed.length >= HOOK_SCORE_MIN_CHARS;
  // Same derived-state pattern as usePolicyCheck: store the async
  // result tagged with its source text; derive null (too-short) /
  // undefined (pending) from the current text so we never call
  // setState synchronously inside the effect. `score: null` is the
  // error sentinel (HookScoreCard hides on null).
  const [res, setRes] = useState<{ forText: string; score: HookScore | null } | null>(null);

  useEffect(() => {
    if (!longEnough) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      linkedInContentApi
        .scoreHook(trimmed)
        .then((s) => {
          if (!cancelled) setRes({ forText: trimmed, score: s });
        })
        .catch(() => {
          if (!cancelled) setRes({ forText: trimmed, score: null });
        });
    }, HOOK_SCORE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [trimmed, longEnough]);

  if (!longEnough) return null;
  if (!res || res.forText !== trimmed) return undefined; // pending
  return res.score;
}

interface HookScoreBand {
  label: string;
  className: string;
}

function bandForScore(score: number): HookScoreBand {
  if (score >= 80)
    return {
      label: "Strong hook",
      className:
        "border-emerald-200 bg-emerald-50/60 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    };
  if (score >= 55)
    return {
      label: "Decent hook",
      className:
        "border-blue-200 bg-blue-50/60 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
    };
  if (score >= 30)
    return {
      label: "Weak hook",
      className:
        "border-amber-200 bg-amber-50/60 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    };
  return {
    label: "Rework the hook",
    className:
      "border-red-200 bg-red-50/60 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  };
}

/**
 * HookScore card — surfaces the v0 score, an honest tier badge, and
 * up to 3 plain-English suggestions.
 */
function HookScoreCard({
  score,
  onRewrite,
  rewritePending,
}: {
  score: HookScore | null | undefined;
  onRewrite?: () => void;
  rewritePending?: boolean;
}) {
  if (score === null) return null;
  if (score === undefined) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Scoring hook…
      </div>
    );
  }
  const band = bandForScore(score.score);
  const topSuggestions = score.suggestions.slice(0, 3);
  const tierMeta = tierBadgeMeta(score.tier);
  return (
    <div className={`space-y-2 rounded-md border px-3 py-2.5 text-sm ${band.className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4" />
          <span className="font-medium">{band.label}</span>
          <span
            className="rounded-sm border border-current/30 px-1.5 py-0 text-[10px] uppercase tracking-wide opacity-80"
            title={tierMeta.tooltip}
          >
            {tierMeta.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onRewrite && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={onRewrite}
              disabled={rewritePending}
              aria-busy={rewritePending}
            >
              {rewritePending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Wand2 className="size-3" />
              )}
              {rewritePending ? "Rewriting…" : "Rewrite"}
            </Button>
          )}
          <span className="font-mono text-base font-semibold tabular-nums">
            {score.score}
            <span className="ml-0.5 text-xs opacity-70">/100</span>
          </span>
        </div>
      </div>
      {score.archetypeMatch && (
        <div className="text-[11px] opacity-80">
          Matched{" "}
          <span className="font-mono">{score.archetypeMatch.cohortId}</span>{" "}
          archetype · cosine{" "}
          {score.archetypeMatch.cosineSimilarity.toFixed(2)} · scored
          against {score.archetypeMatch.exampleCount} examples
        </div>
      )}
      {topSuggestions.length > 0 && (
        <ul className="ml-4 list-disc space-y-0.5 text-xs opacity-90">
          {topSuggestions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Friendlier copy for the tier badge.
 */
function tierBadgeMeta(tier: HookScore["tier"]): { label: string; tooltip: string } {
  switch (tier) {
    case "industry":
      return {
        label: "Tier: industry",
        tooltip:
          "Blended score: 60% cosine similarity to your industry archetype + 40% craft rules. Higher confidence than the rules-only floor.",
      };
    case "personal":
      return {
        label: "Tier: personal",
        tooltip:
          "Blended score: cosine similarity to your own top-performing hooks + craft rules. Most personalised tier.",
      };
    case "rules":
    default:
      return {
        label: "Tier: rules",
        tooltip:
          "Score from craft rules only (length, opener, specific data, audience naming, active voice, line rhythm). No archetype available yet for your cohort.",
      };
  }
}

/**
 * Variants panel — renders the rewrite_hook_variants response.
 */
function HookVariantsPanel({
  response,
  onPick,
  onDismiss,
}: {
  response: RewriteHookResponse;
  onPick: (v: HookVariant) => void;
  onDismiss: () => void;
}) {
  const { variants } = response;
  return (
    <div
      className="space-y-2 rounded-md border bg-muted/20 p-3"
      role="region"
      aria-live="polite"
      aria-label="Hook rewrite suggestions"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Wand2 className="size-4" />
          Rewrite suggestions
          <span className="text-xs font-normal text-muted-foreground">
            (your hook scored {response.original.score})
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={onDismiss}
          aria-label="Dismiss rewrite suggestions"
        >
          <X className="size-3.5" />
        </Button>
      </div>
      {variants.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No rewrites available — try editing the hook yourself and rescoring.
        </p>
      ) : (
        <div className="space-y-1.5">
          {variants.map((v, i) => {
            const band = bandForScore(v.score);
            return (
              <button
                key={i}
                type="button"
                onClick={() => onPick(v)}
                className={`flex w-full flex-col gap-1.5 rounded-md border px-3 py-2 text-left text-sm transition hover:shadow-sm ${band.className}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="line-clamp-3 whitespace-pre-line">{v.hook}</span>
                  <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                    {v.score}
                  </span>
                </div>
                <span className="text-[10px] uppercase tracking-wide opacity-70">
                  {v.technique}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Voice Card panel ─────────────────────────────────────────────────

const PERSPECTIVE_LABEL: Record<LinkedInVoiceCard["voice"]["perspective"], string> = {
  first_person_singular: "I",
  first_person_plural: "We",
  third_person: "They",
};

/**
 * Surface the auto-synthesised LinkedIn voice card alongside the
 * composer so the user sees the tone/perspective/signature phrases
 * we learned from their own posts before they type.
 */
function VoiceCardPanel() {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError, error } = useQuery({
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

  if (isLoading) {
    return (
      <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        Loading your voice card…
      </div>
    );
  }

  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <Mic className="mr-1 inline size-3" />
          Your LinkedIn voice card will appear here once you have 5+ published posts. We&apos;ll learn your tone and signature patterns automatically.
        </div>
      );
    }
    return null;
  }

  if (!data) return null;

  const v = data.voice;
  const s = data.structure;
  const tones = v.tone.slice(0, 4);
  const sigPhrases = v.signaturePhrases.slice(0, 3);
  const neverDoes = v.neverDoes.slice(0, 3);
  const avoidTopics = data.content.avoidTopics.slice(0, 3);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-md border bg-card">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
          >
            <div className="flex items-center gap-2 text-sm">
              <Mic className="size-4 text-muted-foreground" />
              <span className="font-medium">Your LinkedIn voice</span>
              <span className="rounded-sm border px-1.5 py-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                {PERSPECTIVE_LABEL[v.perspective]} · {v.formality}/10 formality
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Trained on {data.generatedFrom} post{data.generatedFrom === 1 ? "" : "s"}
              </span>
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform ${
                  open ? "rotate-180" : ""
                }`}
              />
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t px-3 py-3 text-xs">
          <dl className="grid gap-3 sm:grid-cols-2">
            {tones.length > 0 && (
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Tone</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {tones.map((t) => (
                    <span
                      key={t}
                      className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px]"
                    >
                      {t}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Typical length</dt>
              <dd className="mt-1">
                {s.averageWordCount} words avg · range {s.wordCountRange?.[0] ?? 0}–{s.wordCountRange?.[1] ?? 0}
              </dd>
            </div>
            {sigPhrases.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Signature phrases</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {sigPhrases.map((p) => (
                    <span
                      key={p}
                      className="rounded-sm border bg-muted/40 px-1.5 py-0.5 text-[11px]"
                    >
                      &ldquo;{p}&rdquo;
                    </span>
                  ))}
                </dd>
              </div>
            )}
            {neverDoes.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Never does</dt>
                <dd className="mt-1">
                  <ul className="ml-4 list-disc space-y-0.5 text-[11px] text-muted-foreground">
                    {neverDoes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Opening</dt>
              <dd className="mt-1 line-clamp-2">{s.openingStyle}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Closing</dt>
              <dd className="mt-1 line-clamp-2">{s.closingStyle}</dd>
            </div>
            {avoidTopics.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Avoid topics</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {avoidTopics.map((t) => (
                    <span
                      key={t}
                      className="rounded-sm border border-amber-200 bg-amber-50/60 px-1.5 py-0.5 text-[11px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                    >
                      {t}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
