"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  ChevronDown,
  Link2,
  Loader2,
  Mic,
  Send,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import {
  linkedInContentApi,
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

export function PostComposer({ identity, seedText }: Props) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");

  // Seed the composer when the parent passes a fresh seedText (e.g.,
  // the user clicked "Use this draft" on the Suggested Drafts panel).
  // A ref tracks the last seed we applied so we don't overwrite the
  // user's in-progress edits on every parent re-render.
  const lastSeedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (seedText && seedText !== lastSeedRef.current) {
      lastSeedRef.current = seedText;
      setText(seedText);
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

  // Hook DNA score — debounced live scoring as the user types. Pure
  // server function (no AI, no DB) so it's safe to fire on every
  // 400ms keystroke pause. Score is the v0 Tier-C floor; the badge
  // surfaces "rules" so users see when personalised tiers haven't
  // shipped yet.
  const hookScore = useHookScore(text);

  // Rewrite-hook variants — explicit user action (NOT debounced)
  // because each call is an LLM roundtrip with real cost. Variants
  // panel mounts when present; clears on successful publish or when
  // the user picks one to apply.
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
    // Replace the textarea with the picked variant. Preserves any
    // body content the user wrote BELOW the hook by appending it
    // back — splits on the first blank-line boundary as a "hook
    // ends here" heuristic. Conservative: when no boundary is
    // found, just replaces wholesale.
    const [, ...rest] = text.split(/\n\s*\n/);
    setText(rest.length > 0 ? `${v.hook}\n\n${rest.join("\n\n")}` : v.hook);
    setVariants(null);
  }

  const publish = useMutation({
    mutationFn: (input: PublishLinkedInPostInput) => linkedInContentApi.publish(input),
    onSuccess: () => {
      setText("");
      setLinkUrl("");
      setLinkTitle("");
      setShowLink(false);
      setVariants(null);
      setFeedback({ kind: "success", message: "Post published to LinkedIn." });
      queryClient.invalidateQueries({ queryKey: ["linkedin-me"] });
    },
    onError: (err: unknown) => {
      const message = err instanceof ApiError ? err.message : "Failed to publish post.";
      setFeedback({ kind: "error", message });
    },
  });

  const remaining = MAX_LEN - text.length;
  const tooLong = remaining < 0;
  const empty = text.trim().length === 0;
  const linkInvalid = showLink && linkUrl.trim().length > 0 && !isProbablyUrl(linkUrl);
  const disabled = empty || tooLong || publish.isPending || linkInvalid;

  function onSubmit() {
    if (disabled) return;
    setFeedback(null);

    const author: LinkedInAuthor = isOrgAuthor
      ? { type: "org", pageId: authorKey.slice("org:".length) }
      : { type: "person" };

    const body: PublishLinkedInPostInput = {
      author,
      commentary: text.trim(),
      visibility: effectiveVisibility,
      // TODO: wire ideaId once the strategist→linkedin bridge ships,
      // so org-grounded posts feed the source-usage audit pipeline.
    };

    if (showLink && linkUrl.trim()) {
      body.link = {
        url: linkUrl.trim(),
        title: linkTitle.trim() || undefined,
      };
    }

    publish.mutate(body);
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
            // Suppressed when pages.length === 0 — a user with no admin
            // pages has nothing to enable, so the hint would just confuse.
            <p className="text-xs text-muted-foreground">
              Reconnect LinkedIn to enable posting from your company pages.
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

      <VoiceCardPanel />

      <Textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          // Stale-variant guard — a typing user has moved on from the
          // hook the rewrites were generated for. Keeping the panel
          // visible would let them apply a variant scored against
          // already-discarded text.
          if (variants !== null) setVariants(null);
        }}
        placeholder="Share an update, story, or question…"
        rows={6}
        className="resize-none"
        aria-label="LinkedIn post content"
      />

      <HookScoreCard
        score={hookScore}
        onRewrite={() => {
          // Only fire when there's a real score to improve. Reuse
          // the same min-chars threshold as the live scorer so the
          // button never appears on too-short text.
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

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {!showLink && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowLink(true)}>
              <Link2 className="size-3.5 mr-1" /> Add link
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span
            className={
              tooLong
                ? "text-sm font-medium text-destructive"
                : remaining <= 100
                  ? "text-sm font-medium text-amber-600"
                  : "text-sm text-muted-foreground"
            }
            aria-live="polite"
          >
            {remaining}
          </span>
          <Button onClick={onSubmit} disabled={disabled} aria-busy={publish.isPending}>
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
      // Don't keep retrying if LinkedIn isn't connected — the page
      // will render its EmptyState. Other transient errors get the
      // default retry behavior.
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

// ── Hook DNA scoring ─────────────────────────────────────────────────

const HOOK_SCORE_DEBOUNCE_MS = 400;
const HOOK_SCORE_MIN_CHARS = 8;

/**
 * Debounced hook scorer. Fires `POST /v1/linkedin/content/score-hook`
 * 400ms after the user stops typing. Pure-server function (no AI),
 * so the cost of getting it wrong is just a request, not a token bill.
 *
 * Returns:
 *   - `null` while text is too short to score meaningfully
 *   - `undefined` while a debounce window is still open
 *   - `HookScore` object otherwise
 */
function useHookScore(text: string): HookScore | null | undefined {
  const [score, setScore] = useState<HookScore | null | undefined>(null);

  useEffect(() => {
    const trimmed = text.trim();
    if (trimmed.length < HOOK_SCORE_MIN_CHARS) {
      setScore(null);
      return;
    }
    setScore(undefined); // pending

    // Stale-response guard MUST live at effect-scope so the cleanup
    // closure can flip it. Hoisting it inside the setTimeout callback
    // (a previous attempt) was a no-op — setTimeout ignores callback
    // return values, so the cleanup function returned from there was
    // discarded. A slow first request would silently clobber a faster
    // second one. With the flag at effect-scope, the next text-change
    // tick flips it to true before the in-flight promise can setScore.
    let cancelled = false;
    const handle = window.setTimeout(() => {
      linkedInContentApi
        .scoreHook(trimmed)
        .then((s) => {
          if (!cancelled) setScore(s);
        })
        .catch(() => {
          if (!cancelled) setScore(null);
        });
    }, HOOK_SCORE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [text]);

  return score;
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
 * up to 3 plain-English suggestions. Hidden until the user types
 * enough characters to score (`null`); shows a light pending state
 * while the debounced request is in flight (`undefined`).
 *
 * When `onRewrite` is wired, a Rewrite button appears in the header
 * (LLM-cost action; user clicks explicitly, not on debounce).
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
 * Friendlier copy for the tier badge. "Rules" / "Industry" / "Personal"
 * reads more meaningful than the raw enum value, with a hover tooltip
 * that explains what produced the score so the badge isn't a mystery
 * abbreviation.
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
 * Variants panel — renders the rewrite_hook_variants response. Each
 * row shows the variant text, technique label, and its Hook DNA
 * score (same scale as the live scorer; matches by construction
 * since the API uses the same scoreHookV0). Click to apply.
 *
 * Empty `variants` is rendered as a "no rewrites available" state —
 * the AI occasionally returns near-identical variants that all dedup
 * to nothing useful, and a panel that just disappears would be a
 * silent failure.
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
 * we learned from their own posts before they type. 404 from the
 * endpoint is the expected "we haven't trained yet" path — render
 * a one-line hint and don't surface it as an error.
 */
function VoiceCardPanel() {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["linkedin-voice-card"],
    queryFn: () => linkedInContentApi.voiceCard(),
    retry: (failureCount, err) => {
      // 404 + FORBIDDEN are expected (no card yet / no business
      // selected). Other transient errors get the default retry.
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
    // "Not generated yet" — neutral, not an error.
    if (error instanceof ApiError && error.status === 404) {
      return (
        <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <Mic className="mr-1 inline size-3" />
          Your LinkedIn voice card will appear here once you have 5+ published posts. We&apos;ll learn your tone and signature patterns automatically.
        </div>
      );
    }
    // 403 (no business) or transient — render nothing so the composer
    // stays usable. The Hook DNA panel already conveys the underlying
    // "pick a business" state via its tier badge.
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
