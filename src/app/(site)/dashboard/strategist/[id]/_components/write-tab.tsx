"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError, newActionKey } from "@/lib/api";
import { usePeaksQuote, quoteTokenFor } from "@/hooks/use-peaks-quote";
import { PEAKS_ACTIONS } from "@/lib/api/peaks";
import { PriceLine } from "@/components/audience/discover-audiences-dialog";
import { chargedTaskRefusal } from "@/hooks/use-audience-plan";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ActionCost } from "@/components/dashboard/action-cost";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DrivePicker } from "@/components/drive/drive-picker";
import { SaveToDriveButton } from "@/components/drive/save-to-drive";
import type { SaveToDriveSource } from "@/lib/api/media";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ComposerShell, AiComposeToolbar, EmojiPickerTrigger, DraftSaver, useDraftSaver, type AiActionContext } from "@/components/composer";
import { getVoiceCards, rewriteContent, scoreIdea } from "@/lib/api/content";
import { insertAtCaret } from "@/lib/composer/caret";
import { Loader2, Sparkles, Pen, Eye, Gauge, Image as ImageIcon, X, Lock, Link2, Check } from "lucide-react";
import { ArticlePreview, IdeaDetail, ImagePlaceholder, StreamProgress, aiOpToast, consumeSSE, mapNewsletterVoiceCard } from "./shared";
import { DataCitationsPanel } from "./review-tab";

/**
 * Image-placeholder rail — renders the writer's
 * content.imagePlaceholders[] inline with a delete affordance.
 * Phase 1: text-only; clicking a placeholder lets the user edit
 * description or remove it entirely. Phase 2 (image gen via
 * Vercel Gateway → Imagen) replaces status="placeholder" with
 * status="generated" + resolvedImageUrl on the same array entry.
 */
function ImagePlaceholderRail({
  placeholders,
  onDelete,
  onGenerate,
  onSupplyUrl,
  onPickFromLibrary,
  busy,
  finalized,
  generatingIndex,
  resolvingIndex,
}: {
  placeholders: ImagePlaceholder[];
  onDelete: (index: number) => void;
  /** `quoteToken` is the receipt for the price the merchant was shown beside the buttons (absent while none is held). */
  onGenerate: (index: number, quoteToken?: string) => void;
  /** Resolve a placeholder from an external URL (status "supplied"). */
  onSupplyUrl: (index: number, url: string) => void;
  /** Resolve from the media library / an upload (status "uploaded"). */
  onPickFromLibrary: (index: number, url: string, mediaId: string) => void;
  busy: boolean;
  finalized: boolean;
  generatingIndex: number | null;
  resolvingIndex: number | null;
}) {
  // The price of one image, asked for while the buttons are usable and shown before any is pressed (C7: the cost is known upfront).
  const price = usePeaksQuote(PEAKS_ACTIONS.generateImage, finalized && placeholders.length > 0);
  if (!placeholders.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Image placeholders <span className="text-muted-foreground font-normal">({placeholders.length})</span></CardTitle>
        <CardDescription className="text-xs">
          {finalized
            ? "Text finalized — per placeholder: Generate with AI, paste an image URL, or choose from Drive (you can upload or generate there too). Delete what you don't want first."
            : "Delete what you don't want; Finalize text to unlock image generation."}
        </CardDescription>
        {finalized ? (
          <div className="text-xs text-muted-foreground">
            <span>Each AI image: </span>
            <PriceLine price={price} />
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 sm:grid-cols-2">
          {placeholders.map((p, i) => (
            <PlaceholderCard
              key={i}
              p={p}
              index={i}
              onDelete={onDelete}
              onGenerate={(idx) => onGenerate(idx, quoteTokenFor(price).quoteToken)}
              onSupplyUrl={onSupplyUrl}
              onPickFromLibrary={onPickFromLibrary}
              busy={busy}
              finalized={finalized}
              isGenerating={generatingIndex === i}
              isResolving={resolvingIndex === i}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * One placeholder card. Owns its local paste-URL input toggle so the
 * parent rail stays stateless. Resolution paths:
 *   - Generate  → AI image pipeline (status "generated"), gated on finalize
 *   - Paste URL → external URL        (status "supplied"),  gated on finalize
 *   - Drive     → pick from Drive, upload or generate (status "uploaded" +
 *                 mediaId), gated on finalize — via <DrivePicker>.
 */
/** What Save to Drive is given for a placeholder's image: the AI image as data or as a link, or the address that was pasted. Anything else (a blob, a data URL that is not an AI image) is not offered. */
function saveSource(p: ImagePlaceholder): SaveToDriveSource | null {
  const url = p.resolvedImageUrl;
  if (!url) return null;
  if (p.status === "generated") return url.startsWith("data:") ? { from: "ai_image", dataUrl: url } : /^https:\/\//i.test(url) ? { from: "ai_image", imageUrl: url } : null;
  return /^https:\/\//i.test(url) ? { from: "draft_asset", url } : null;
}

function PlaceholderCard({
  p,
  index,
  onDelete,
  onGenerate,
  onSupplyUrl,
  onPickFromLibrary,
  busy,
  finalized,
  isGenerating,
  isResolving,
}: {
  p: ImagePlaceholder;
  index: number;
  onDelete: (index: number) => void;
  onGenerate: (index: number) => void;
  onSupplyUrl: (index: number, url: string) => void;
  onPickFromLibrary: (index: number, url: string, mediaId: string) => void;
  busy: boolean;
  finalized: boolean;
  isGenerating: boolean;
  isResolving: boolean;
}) {
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const resolved = !!p.resolvedImageUrl &&
    (p.status === "generated" || p.status === "supplied" || p.status === "uploaded");
  const rowBusy = busy || isGenerating || isResolving;
  const saveSrc = saveSource(p);

  const statusLabel = p.status === "generated" ? "Generated"
    : p.status === "supplied" ? "From URL"
    : p.status === "uploaded" ? "From Drive"
    : null;

  function submitUrl() {
    const trimmed = urlValue.trim();
    if (!trimmed) return;
    onSupplyUrl(index, trimmed);
    setUrlOpen(false);
    setUrlValue("");
  }

  return (
    <li className={`rounded-md border p-3 text-sm flex items-start justify-between gap-2 ${resolved ? "bg-success/10 border-success/30" : "bg-muted/20"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <Badge variant="outline" className="text-[10px]">{p.position}</Badge>
          <Badge variant="secondary" className="text-[10px]">{p.dimensions}</Badge>
          {statusLabel && <Badge variant="default" className="text-[10px]">{statusLabel}</Badge>}
        </div>
        <p className="font-medium truncate" title={p.purpose}>{p.purpose}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
        {p.suggestedCaption && <p className="text-xs italic mt-1 text-muted-foreground">&ldquo;{p.suggestedCaption}&rdquo;</p>}
        {resolved && p.resolvedImageUrl && (
          <div className="mt-2 rounded-md overflow-hidden border bg-background">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.resolvedImageUrl} alt={p.suggestedAltText} className="block w-full h-auto" />
          </div>
        )}
        {/* An image Drive does not hold yet (an AI image kept as data, or a picture from a pasted address): keep it (D8). */}
        {resolved && p.resolvedImageUrl && !p.mediaId && saveSrc && (
          <div className="mt-2">
            <SaveToDriveButton key={p.resolvedImageUrl} source={saveSrc} />
          </div>
        )}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onGenerate(index)}
            disabled={rowBusy || !finalized}
            className="text-xs font-medium px-2.5 py-1 rounded border bg-background hover:bg-accent disabled:opacity-40 flex items-center gap-1"
            title={finalized ? (resolved ? "Regenerate (overwrites the current image)" : "Generate image via AI") : "Finalize text first to unlock generation"}
          >
            {isGenerating
              ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</>
              : resolved
                ? <><Sparkles className="h-3 w-3" /> Regenerate</>
                : <><Sparkles className="h-3 w-3" /> Generate</>}
          </button>
          <button
            type="button"
            onClick={() => setUrlOpen((v) => !v)}
            disabled={rowBusy || !finalized}
            className="text-xs font-medium px-2.5 py-1 rounded border bg-background hover:bg-accent disabled:opacity-40 flex items-center gap-1"
            title={finalized ? "Paste an image URL" : "Finalize text first to unlock"}
          >
            {isResolving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />} Paste URL
          </button>
          <DrivePicker
            maxSelection={1}
            kinds={["image"]}
            target={{ channel: "newsletter", label: "a newsletter" }}
            addLabel="Use this image"
            // Generate makes THIS spot's image from its description (the same call as the Generate button); the card shows the result.
            generatePrompt={p.description}
            generatePriced
            promptEditable={false}
            onGenerate={async () => {
              onGenerate(index);
            }}
            onSelect={(assets) => {
              const a = assets[0];
              if (a) onPickFromLibrary(index, a.url, a.id);
            }}
            trigger={
              <button
                type="button"
                disabled={rowBusy || !finalized}
                className="text-xs font-medium px-2.5 py-1 rounded border bg-background hover:bg-accent disabled:opacity-40 flex items-center gap-1"
                title={finalized ? "Choose from Drive, upload, or generate" : "Finalize text first to unlock"}
              >
                <ImageIcon className="h-3 w-3" /> Drive
              </button>
            }
          />
        </div>
        {urlOpen && (
          <div className="mt-2 flex items-center gap-1.5">
            <Input
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitUrl(); } }}
              placeholder="https://…/image.jpg"
              className="h-7 text-xs"
              autoFocus
            />
            <button
              type="button"
              onClick={submitUrl}
              disabled={rowBusy || !urlValue.trim()}
              className="shrink-0 text-xs font-medium px-2 py-1 rounded border bg-background hover:bg-accent disabled:opacity-40 flex items-center gap-1"
              aria-label="Set image URL"
            >
              <Check className="h-3 w-3" /> Set
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDelete(index)}
        disabled={rowBusy}
        className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-40"
        aria-label={`Delete placeholder ${index + 1}`}
        title="Delete placeholder"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}

/**
 * Finalize gate — locks the text content so the Images stage
 * (Phase 2) can run without further text edits. Today emits a
 * signal-style PUT to /v1/content/ideas/:id/content with a
 * finalizedAt stamp; the b2c then surfaces a "Locked" badge.
 * No status transition — that lands when Phase 2 ships the
 * Images tab. In the interim, the visible Finalize button sets
 * the mental model for the editorial gate.
 */
function FinalizeButton({
  finalized,
  busy,
  onFinalize,
}: {
  finalized: boolean;
  busy: boolean;
  onFinalize: () => void;
}) {
  return (
    <Button
      variant={finalized ? "outline" : "default"}
      onClick={onFinalize}
      disabled={busy || finalized}
      className="gap-1.5"
    >
      {finalized ? <><Lock className="h-3.5 w-3.5" /> Text finalized</> : <><Lock className="h-3.5 w-3.5" /> Finalize text</>}
    </Button>
  );
}

export function WriteTab({ idea, ideaId, onRefresh }: { idea: IdeaDetail; ideaId: string; onRefresh: () => void }) {
  const [html, setHtml] = useState(idea.content?.html || "");
  const [subject, setSubject] = useState(idea.content?.subject || "");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<StreamProgress | null>(null);
  const [preview, setPreview] = useState(false);

  // Sync local edit state when the upstream idea.content changes
  // (e.g. after generation/save). Track last-seen values; reset on change.
  const [lastSyncedHtml, setLastSyncedHtml] = useState(idea.content?.html || "");
  const [lastSyncedSubject, setLastSyncedSubject] = useState(idea.content?.subject || "");
  // Phase 2 per-placeholder image generation index. Declared with the
  // other hooks at the top — MUST be unconditional (it previously sat
  // after this component's early returns, a react-hooks/rules-of-hooks
  // violation).
  const queryClient = useQueryClient();
  const [generatingPlaceholderIdx, setGeneratingPlaceholderIdx] = useState<number | null>(null);
  // Per-placeholder resolution busy index (paste-URL / library pick).
  const [resolvingPlaceholderIdx, setResolvingPlaceholderIdx] = useState<number | null>(null);
  // On-demand article quality score. Seeded from any persisted score.
  const [scoring, setScoring] = useState(false);
  const [quality, setQuality] = useState<{ score: number; notes: string } | null>(
    idea.content?.qualityScore != null
      ? { score: idea.content.qualityScore, notes: idea.content.qualityNotes ?? "" }
      : null,
  );
  const runScore = useCallback(async () => {
    if (scoring) return;
    setScoring(true);
    try {
      const r = await scoreIdea(ideaId);
      setQuality({ score: r.qualityScore, notes: r.qualityNotes });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't score the article");
    } finally {
      setScoring(false);
    }
  }, [ideaId, scoring]);
  const scoreTone = (s: number) =>
    s >= 9 ? "bg-success/15 text-success-on-tint"
      : s >= 7 ? "bg-warning/15 text-warning-on-tint"
        : "bg-destructive/15 text-destructive-on-tint";

  // ── Shared composer chrome (parity with LinkedIn/X) ─────────────
  // The HTML body textarea + a caret tracked on every selection change
  // and on blur — emoji / AI-insert ops splice at this caret (the
  // popover/toolbar steals focus, so a live selectionStart read would
  // fall back to 0/end; capturing on blur is the fix the kit uses).
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  // Caret lives in a ref only (no state): the textarea is controlled by
  // `value={html}`, not the caret, and insertSnippet reads the freshest
  // position off the live element (falling back to this ref when the
  // textarea isn't focused). A state caret would just be an unused
  // re-render. Captured on select/click/keyup/blur via updateCaret.
  const caretRef = useRef(0);
  const updateCaret = useCallback(() => {
    const el = htmlRef.current;
    if (el) caretRef.current = el.selectionStart ?? el.value.length;
  }, []);

  // Voice-card chip — newsletter category, matched like the other
  // composers. Read-only display; the rewrite skill pulls the live
  // brand voice server-side.
  const voiceCardQuery = useQuery({
    queryKey: ["voice-cards", "newsletter"],
    queryFn: () => getVoiceCards({ channel: "newsletter" }),
    staleTime: 300_000,
  });
  const voiceSummary = useMemo(
    () => mapNewsletterVoiceCard(voiceCardQuery.data),
    [voiceCardQuery.data],
  );

  // Insert a snippet (emoji glyph or AI quote/disclosure) at the tracked
  // caret in the HTML body, then restore focus + selection. Returns the
  // new body so callers can chain. Mirrors LinkedIn/X: reads the LIVE
  // body + caret off the textarea element (not closed-over state) so a
  // splice during an in-flight AI insert lands on the freshest text and
  // doesn't drop keystrokes typed mid-call. Stable identity (no deps) →
  // handleAiAction stays stable too. Falls back to the tracked `caret`
  // state when the element isn't focused/mounted.
  const insertSnippet = useCallback(
    (snippet: string): string => {
      const el = htmlRef.current;
      const baseText = el ? el.value : "";
      const baseCaret = el ? (el.selectionStart ?? baseText.length) : caretRef.current;
      const { text: next, caret: nextCaret } = insertAtCaret(baseText, baseCaret, snippet);
      setHtml(next);
      caretRef.current = nextCaret;
      requestAnimationFrame(() => {
        const node = htmlRef.current;
        if (node) {
          node.focus();
          node.setSelectionRange(nextCaret, nextCaret);
        }
      });
      return next;
    },
    [],
  );

  // AI compose toolbar handler. format:"html" so the rewrite skill
  // preserves the newsletter body's semantic structure instead of
  // flattening it to prose. Replace ops swap the whole body; insert
  // ops (quote/disclosure) splice a plain-text snippet at the caret.
  const handleAiAction = useCallback(
    async (ctx: AiActionContext): Promise<string> => {
      const res = await rewriteContent({
        op: ctx.op,
        text: ctx.text,
        platform: "beehiiv",
        format: "html",
        ...(ctx.extras ? { extras: ctx.extras } : {}),
      });
      let newText: string;
      if (res.insert === true) {
        newText = insertSnippet(res.text);
      } else {
        newText = res.text;
        setHtml(newText);
      }
      toast.success(aiOpToast(ctx.op));
      return newText;
    },
    [insertSnippet],
  );

  // Auto-save the in-progress body to the idea's content. Suspended once
  // the text is finalized (the finalize stamp locks editing) and while
  // there's no body yet. Debounced 2s — same cadence as the publish
  // composers. The manual Save button stays as an explicit affordance.
  const finalizedForSave = !!(idea.content as { textFinalizedAt?: string } | undefined)?.textFinalizedAt;
  const autoSaveValue = finalizedForSave ? null : html;
  const saveBody = useCallback(
    async (value: string) => {
      await api.put(`/v1/content/ideas/${ideaId}/content`, { html: value, subject });
    },
    [ideaId, subject],
  );
  const {
    status: draftStatus,
    lastSavedAt,
    lastError: draftError,
    saveNow,
  } = useDraftSaver<string>({ value: autoSaveValue, save: saveBody });

  if (idea.content?.html && idea.content.html !== lastSyncedHtml) {
    setLastSyncedHtml(idea.content.html);
    setHtml(idea.content.html);
  }
  if (idea.content?.subject && idea.content.subject !== lastSyncedSubject) {
    setLastSyncedSubject(idea.content.subject);
    setSubject(idea.content.subject);
  }

  const generate = useCallback(async () => {
    setGenerating(true);
    setProgress(null);
    try {
      const res = await api.streamPost(`/v1/content/ideas/${ideaId}/generate-content`, undefined, newActionKey());
      const result = await consumeSSE(res, setProgress);
      if (result.event === "complete") {
        toast.success("Draft generated");
        onRefresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Content generation failed");
    }
    setGenerating(false);
    setProgress(null);
  }, [ideaId, onRefresh]);

  if (!idea.brief) return <Card><CardContent className="py-12 text-center text-muted-foreground">Generate a brief first.</CardContent></Card>;

  if (!idea.content?.html && !html) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          {generating ? (
            <>
              <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-primary" />
              <p className="mb-1 font-medium">Writing first draft...</p>
              {progress && (
                <p className="text-sm text-muted-foreground animate-pulse">
                  Step {progress.step}: {progress.label}
                </p>
              )}
            </>
          ) : (
            <>
              <Pen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="mb-4 text-muted-foreground">AI will write the first draft from your brief.</p>
              <Button onClick={generate}>
                <Sparkles className="mr-1.5 h-4 w-4" />
                Generate First Draft
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put(`/v1/content/ideas/${ideaId}/content`, { html, subject });
      toast.success("Content saved");
      onRefresh();
    } catch {
      toast.error("Save failed");
    }
    setSaving(false);
  }

  // Image placeholder + Finalize wiring (PR 11). Both write back via
  // the existing /content PUT endpoint — keeps the route surface
  // minimal. Deletion filters the array; finalize sets a stamp the
  // backend reads when Phase 2 image-gen UI ships.
  const placeholders = idea.content?.imagePlaceholders ?? [];
  const finalized = !!(idea.content as { textFinalizedAt?: string } | undefined)?.textFinalizedAt;
  async function handleDeletePlaceholder(index: number) {
    setSaving(true);
    try {
      const next = placeholders.filter((_, i) => i !== index);
      await api.put(`/v1/content/ideas/${ideaId}/content`, { imagePlaceholders: next });
      toast.success("Placeholder removed");
      onRefresh();
    } catch {
      toast.error("Failed to remove placeholder");
    }
    setSaving(false);
  }
  async function handleFinalize() {
    setSaving(true);
    try {
      await api.put(`/v1/content/ideas/${ideaId}/content`, { textFinalizedAt: new Date().toISOString() });
      toast.success("Text finalized — Images stage unlocks next");
      onRefresh();
    } catch {
      toast.error("Failed to finalize");
    }
    setSaving(false);
  }

  // Phase 2: per-placeholder AI image generation. Hard-gated on
  // textFinalizedAt by the api (returns 400 TEXT_NOT_FINALIZED if
  // user clicks Generate before Finalize). UI also disables the
  // button when !finalized so the gate is enforced both sides.
  // (state declared with the other hooks at the top — see note there.)
  async function handleGeneratePlaceholder(index: number, quoteToken?: string) {
    setGeneratingPlaceholderIdx(index);
    try {
      // One key per click: a retry or a double click of this click is one charge (the api derives the charge id from it).
      await api.post(`/v1/content/ideas/${ideaId}/placeholders/${index}/generate`, {}, { ...newActionKey(), ...(quoteToken ? { "x-peaks-quote": quoteToken } : {}) });
      toast.success(`Image ${index + 1} generated`);
      onRefresh();
    } catch (err) {
      // Refused before it started (too few credits, already running): nothing was charged, and the api says what to do.
      const refusal = err instanceof ApiError ? chargedTaskRefusal(err.code, err.message) : undefined;
      if (refusal) toast.error(refusal.title, { description: refusal.description });
      else if (err instanceof ApiError && err.code === "QUOTE_NOT_HONOURED") {
        // The receipt for the price shown has lapsed: nothing ran. Drop it so the price is asked for again, then press again.
        queryClient.resetQueries({ queryKey: ["peaks-quote"] });
        toast.error("That price has changed.", { description: err.message || "Ask for a fresh quote and confirm the new price." });
      } else if (err instanceof ApiError) {
        // The api answered with a failure: a held charge is released only on success, so nothing was charged.
        toast.error(err.message || "Image generation failed.", { description: "You were not charged." });
      } else toast.error(err instanceof Error ? err.message : "Image generation failed.");
    }
    setGeneratingPlaceholderIdx(null);
  }

  // Resolve a placeholder by SUPPLYING an external URL (status
  // "supplied") or PICKING from the media library (status "uploaded").
  // Both write the chosen URL onto the placeholder via the same /content
  // PUT the rest of the rail uses. Gated on finalize like Generate, so
  // images are only resolved once the text is locked.
  async function handleResolvePlaceholder(
    index: number,
    resolvedImageUrl: string,
    status: "supplied" | "uploaded",
    mediaId?: string,
  ) {
    setResolvingPlaceholderIdx(index);
    try {
      const next = placeholders.map((p, i) =>
        i === index
          ? { ...p, resolvedImageUrl, status, ...(mediaId ? { mediaId } : {}) }
          : p,
      );
      await api.put(`/v1/content/ideas/${ideaId}/content`, { imagePlaceholders: next });
      toast.success(`Image ${index + 1} set`);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set image");
    }
    setResolvingPlaceholderIdx(null);
  }

  const citations = idea.content?.dataCitations;
  const isNewsletter = !idea.contentFormat || idea.contentFormat === "newsletter";

  // minmax(0,1fr) — NOT 1fr — so the editor column can shrink below its
  // content's min-content width. A bare `1fr` track keeps its implicit
  // `min-width:auto`, so a long unbreakable token (a URL in a citation, a
  // mono HTML line in the editor) forces the track wider than the
  // viewport, pushing the fixed 320px rail out and creating the empty gap
  // + horizontal scroll on the right.
  return (
    <div className={citations?.length ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]" : ""}>
      {/* Routed through the shared <ComposerShell> for cross-surface
          consistency with LinkedIn / X. Voice chip + AI toolbar mounted;
          the AI toolbar is gated to Edit mode (it operates on the HTML
          body, which Preview doesn't expose for editing) and suppressed
          once the text is finalized. format:"html" keeps the rewrite
          from flattening the newsletter's semantic structure. The
          mid-column Save/Regenerate/Finalize row + image rail stay as
          children to preserve the existing order. */}
      <ComposerShell
        mode="compose"
        voiceCard={voiceSummary}
        toolbarSlot={
          !preview && !finalized ? (
            <AiComposeToolbar
              text={html}
              platform="beehiiv"
              onAiAction={handleAiAction}
            />
          ) : undefined
        }
      >
        {/* Subject line only for newsletter format. Article / PR /
            advertorial outputs don't carry a subject; their headline
            is in the HTML body already (write_article/pr/advertorial
            emit subject = headline as a back-compat shim). */}
        {isNewsletter ? (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Subject Line</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject line..." />
          </div>
        ) : (
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            Format: <span className="font-medium text-foreground">{idea.contentFormat}</span>. Headline + metadata stamped on content; edit them in the body / dedicated panels below.
          </div>
        )}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreview(false)}
                className={`text-xs font-medium px-2 py-1 rounded transition-colors ${!preview ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Pen className="mr-1 inline h-3 w-3" />Edit
              </button>
              <button
                type="button"
                onClick={() => setPreview(true)}
                className={`text-xs font-medium px-2 py-1 rounded transition-colors ${preview ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Eye className="mr-1 inline h-3 w-3" />Preview
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {idea.content?.wordCount != null && <span>{idea.content.wordCount} words · v{idea.content.version}</span>}
              {/* On-demand quality score */}
              {quality && (
                <Badge
                  className={cn("h-5 gap-1 px-1.5 text-[10px] font-semibold border-0", scoreTone(quality.score))}
                  title={quality.notes}
                >
                  <Gauge className="size-3" /> {quality.score}/10
                </Badge>
              )}
              <button
                type="button"
                onClick={runScore}
                disabled={scoring}
                title={quality?.notes || "Score this article 0–10 against a 10-point quality rubric"}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                {scoring ? <Loader2 className="size-3 animate-spin" /> : <Gauge className="size-3" />}
                {quality ? "Re-check" : "Check quality"}
              </button>
            </div>
          </div>
          {quality?.notes && (
            <p className="mt-1.5 text-xs italic text-muted-foreground">
              Editor note: {quality.notes}
            </p>
          )}
          {preview ? (
            <div className="w-full min-h-[30rem] rounded-md border bg-background p-6 prose prose-sm dark:prose-invert max-w-none overflow-auto">
              <ArticlePreview html={html} placeholders={placeholders} />
            </div>
          ) : (
            <textarea
              ref={htmlRef}
              value={html}
              onChange={(e) => { setHtml(e.target.value); caretRef.current = e.target.selectionStart ?? e.target.value.length; }}
              onSelect={updateCaret}
              onClick={updateCaret}
              onKeyUp={updateCaret}
              // Capture caret on blur too — the emoji popover / AI insert
              // buttons steal focus, and selectionStart still holds the
              // last position at blur time. Without this an insert lands
              // at 0/end (the kit-wide emoji bug).
              onBlur={updateCaret}
              rows={20}
              className="w-full rounded-md border bg-background p-4 font-mono text-sm outline-none focus:ring-1 focus:ring-ring"
              placeholder="Newsletter content (HTML)..."
            />
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          <Button size="sm" onClick={handleSave} disabled={saving || finalized}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Save
          </Button>
          <Button size="sm" variant="outline" onClick={generate} disabled={generating || finalized}>
            {generating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
            Regenerate
          </Button>
          <ActionCost action="contentDraft" className="text-xs" />
          {/* Emoji insert — only in Edit mode (operates on the textarea
              caret) and before finalize. */}
          {!preview && !finalized && <EmojiPickerTrigger onInsert={insertSnippet} />}
          {/* Auto-save status pill — sits next to the manual Save so the
              user sees the debounced save land. */}
          <DraftSaver
            status={draftStatus}
            lastSavedAt={lastSavedAt}
            lastError={draftError}
            onRetry={saveNow}
          />
          <div className="ml-auto">
            <FinalizeButton finalized={finalized} busy={saving} onFinalize={handleFinalize} />
          </div>
        </div>
        <ImagePlaceholderRail
          placeholders={placeholders}
          onDelete={handleDeletePlaceholder}
          onGenerate={handleGeneratePlaceholder}
          onSupplyUrl={(i, url) => handleResolvePlaceholder(i, url, "supplied")}
          onPickFromLibrary={(i, url, mediaId) => handleResolvePlaceholder(i, url, "uploaded", mediaId)}
          /* Disable ALL per-row actions while any row is resolving/generating:
             each handler maps over the prop-derived placeholders array, so a
             concurrent second-row write would build on a stale array and clobber
             the first row's just-set resolution (review M4). */
          busy={saving || generatingPlaceholderIdx !== null || resolvingPlaceholderIdx !== null}
          finalized={finalized}
          generatingIndex={generatingPlaceholderIdx}
          resolvingIndex={resolvingPlaceholderIdx}
        />
      </ComposerShell>
      {citations?.length ? <DataCitationsPanel citations={citations} /> : null}
    </div>
  );
}
