"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import { createSource, recommendSourcesFromCompetitor } from "../api";
import { defaultDisplayName, detectSourceType } from "../lib/detect-type";
import { OpmlParseError, parseOpml } from "../lib/parse-opml";
import {
  FETCH_FREQUENCY_LABEL,
  SOURCE_TYPE_LABEL,
  type CreateSourceInput,
  type FetchFrequency,
  type RecommendedSource,
  type SourceType,
} from "../types";

/**
 * Add Source drawer — Day-4 surface per the LinkedIn 360 plan §3.4.
 *
 * Hosts four input modes via Tabs:
 *   • Manual    — type-specific form (Day-1 ship; PR #162).
 *   • Bulk      — paste one URL/handle per line, auto-detect type,
 *                 review preview, batch-create.
 *   • OPML      — upload an OPML/.xml export (Feedly, NetNewsWire,
 *                 etc.), preview, batch-create.
 *   • Compete   — paste a competitor URL, the
 *                 `trusted_sources.competitor_recommender` AI use case
 *                 proposes 0–12 candidate sources scored with
 *                 confidence + relevance reason. Approved
 *                 recommendations land as `status: "suggested"` (NOT
 *                 active) so the operator reviews them under the
 *                 Suggested tab before they join the active fetch
 *                 pool — half the AI's guesses might be hallucinated
 *                 handles, and we don't want those polluting the
 *                 active pool with accumulating fetch failures.
 *
 * Bulk + OPML + Compete share the BulkPreview + BulkSubmitFooter
 * pattern. Compete's CompetitorPreview wraps BulkPreview-shaped data
 * with per-row reason + confidence chrome.
 */

const SOURCE_TYPES: SourceType[] = [
  "website",
  "rss",
  "newsletter",
  "x_handle",
  "instagram_handle",
  "youtube_channel",
  "podcast",
  "uploaded_doc",
];

const FETCH_FREQUENCIES: FetchFrequency[] = ["hourly", "daily", "weekly", "manual"];

type DrawerTab = "manual" | "bulk" | "opml" | "compete";

export function AddSourceDrawer() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<DrawerTab>("manual");

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 size-4" />
          Add source
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Add trusted sources</SheetTitle>
          <SheetDescription>
            Sources ground every brief, idea, and post in your brand&apos;s voice. Active sources are picked up by the next 15-minute fetch.
          </SheetDescription>
        </SheetHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as DrawerTab)} className="flex flex-1 flex-col overflow-hidden">
          <TabsList className="mx-4">
            <TabsTrigger value="manual">Manual</TabsTrigger>
            <TabsTrigger value="bulk">Bulk paste</TabsTrigger>
            <TabsTrigger value="opml">OPML</TabsTrigger>
            <TabsTrigger value="compete">From competitor</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="flex flex-1 flex-col overflow-hidden">
            <ManualTab onClose={() => setOpen(false)} />
          </TabsContent>
          <TabsContent value="bulk" className="flex flex-1 flex-col overflow-hidden">
            <BulkPasteTab onClose={() => setOpen(false)} />
          </TabsContent>
          <TabsContent value="opml" className="flex flex-1 flex-col overflow-hidden">
            <OpmlTab onClose={() => setOpen(false)} />
          </TabsContent>
          <TabsContent value="compete" className="flex flex-1 flex-col overflow-hidden">
            <CompetitorTab onClose={() => setOpen(false)} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

/* ── Manual tab ──────────────────────────────────────────────── */

function ManualTab({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<SourceType>("website");
  const [identifier, setIdentifier] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fetchFrequency, setFetchFrequency] = useState<FetchFrequency>("daily");

  const queryClient = useQueryClient();

  function reset() {
    setType("website");
    setIdentifier("");
    setDisplayName("");
    setFetchFrequency("daily");
  }

  // Mutation takes the snapshot of trimmed values explicitly via a
  // `variables` arg so the success toast and any error context read
  // the values that were submitted, not whatever the input fields
  // happen to contain when the response arrives.
  const mutation = useMutation({
    mutationFn: (vars: CreateSourceInput) => createSource(vars),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["trusted-sources"] });
      toast.success(`${vars.displayName || "Source"} added`);
      onClose();
      // Reset after the close animation so the form doesn't visibly
      // clear while the sheet is fading out (~300ms).
      setTimeout(reset, 350);
    },
    onError: (err) => {
      // The backend's POST returns 409 with a copy-friendly message
      // ("Source already exists for this business at <identifier>") —
      // surface it verbatim instead of the generic "create failed".
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Could not add source");
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedIdentifier = identifier.trim();
    const trimmedName = displayName.trim();
    if (!trimmedIdentifier || !trimmedName) {
      toast.error("Identifier and name are required");
      return;
    }
    mutation.mutate({
      type,
      identifier: trimmedIdentifier,
      displayName: trimmedName,
      fetchFrequency,
    });
  }

  return (
    <>
      {/* Form fills the sheet's content width to match the bulk / opml
          tabs. An earlier `sm:max-w-md` constraint here capped the
          form at 28rem inside a 42rem sheet, leaving ~14rem of dead
          space on the right — visible as a big gap and the only tab
          whose layout drifted from its siblings. If the four-field
          form ever reads too loose, swap to `mx-auto max-w-lg` so the
          gutters balance instead of pooling on one side. */}
      <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-5 overflow-auto px-4 pt-4">
        <div className="grid gap-2">
          <Label htmlFor="source-type">Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as SourceType)}>
            <SelectTrigger id="source-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {SOURCE_TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="source-identifier">
            {type === "x_handle" || type === "instagram_handle"
              ? "Handle (e.g. @example)"
              : type === "uploaded_doc"
                ? "Document key"
                : "URL"}
          </Label>
          <Input
            id="source-identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={
              type === "rss"
                ? "https://example.com/feed.xml"
                : type === "x_handle"
                  ? "@example"
                  : "https://example.com"
            }
            autoComplete="off"
            autoFocus
            required
          />
          <p className="text-xs text-muted-foreground">
            Stored normalised — handles lowercase, URLs preserve path case.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="source-name">Display name</Label>
          <Input
            id="source-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="What you'd call this source in the team chat"
            maxLength={256}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="source-frequency">Fetch frequency</Label>
          <Select
            value={fetchFrequency}
            onValueChange={(v) => setFetchFrequency(v as FetchFrequency)}
          >
            <SelectTrigger id="source-frequency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FETCH_FREQUENCIES.map((f) => (
                <SelectItem key={f} value={f}>
                  {FETCH_FREQUENCY_LABEL[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Daily is right for almost everything; pick weekly for slow-moving sites and manual for archival material.
          </p>
        </div>
      </form>

      <SheetFooter>
        <Button variant="outline" type="button" onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button onClick={onSubmit} disabled={mutation.isPending}>
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-1.5 size-4 animate-spin" />
              Adding…
            </>
          ) : (
            "Add source"
          )}
        </Button>
      </SheetFooter>
    </>
  );
}

/* ── Bulk paste tab ──────────────────────────────────────────── */

function BulkPasteTab({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");

  // Parse on every change. Cheap (regex + URL parse per line) and
  // the live preview is half the value of this surface — typing a
  // line and immediately seeing its detected type catches mistakes
  // (twitter→x_handle vs status→website) before submit.
  const parsed = useMemo<CreateSourceInput[]>(() => {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({
        type: detectSourceType(line),
        identifier: line,
        displayName: defaultDisplayName(line),
        fetchFrequency: "daily" as FetchFrequency,
      }));
  }, [text]);

  return (
    <>
      <div className="flex flex-1 flex-col gap-3 overflow-auto px-4 pt-4">
        <div className="grid gap-2">
          <Label htmlFor="bulk-paste">One URL or handle per line</Label>
          <Textarea
            id="bulk-paste"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"https://example.com/blog\n@another-account\nhttps://news.example.com/feed.xml"}
            rows={6}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Type is auto-detected per line. RSS feeds, X/Instagram/YouTube, Substack/Beehiiv newsletters all recognised. Plain URLs default to website.
          </p>
        </div>
        <BulkPreview rows={parsed} />
      </div>
      <BulkSubmitFooter rows={parsed} onClose={onClose} />
    </>
  );
}

/* ── OPML tab ────────────────────────────────────────────────── */

function OpmlTab({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<CreateSourceInput[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function ingestFile(file: File) {
    setFileName(file.name);
    try {
      const xml = await file.text();
      const parsed = parseOpml(xml);
      // Drop the parser's `category` field — the backend doesn't
      // model categories. Explicit field copy (vs spread+omit) so a
      // future ParsedOpmlRow addition lands as a TS error here, not
      // as silent leakage into the create payload. fetchFrequency
      // defaults to "daily" since OPML doesn't carry one.
      const ready: CreateSourceInput[] = parsed.map((row) => ({
        type: row.type,
        identifier: row.identifier,
        displayName: row.displayName,
        fetchFrequency: "daily",
      }));
      setRows(ready);
      if (ready.length === 0) {
        toast.warning("No feeds found in the OPML file");
      } else {
        toast.success(`Found ${ready.length} feed${ready.length === 1 ? "" : "s"}`);
      }
    } catch (err) {
      if (err instanceof OpmlParseError) toast.error(err.message);
      else toast.error("Could not read the OPML file");
      setRows([]);
    }
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input value AFTER reading the file so re-picking
    // the same file fires `change` again. Browsers (Chrome/Safari)
    // suppress onChange when the user re-selects an identical
    // FileList; clearing the value forces a fresh selection.
    if (file) {
      ingestFile(file);
      e.target.value = "";
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) ingestFile(file);
  }

  function clear() {
    setRows([]);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-3 overflow-auto px-4 pt-4">
        {/* Drop-or-click affordance — visual pattern adapted from
            @shadcnblocks/file-upload-file-upload-dropzone-3 (compact
            horizontal arrangement: icon + dual-line label). The
            block depends on a third-party Dice UI primitive; we
            keep the visual idiom but use HTML5 drag-and-drop
            directly so no extra dep tree lands for one OPML upload.
            Clicking the zone or pressing Enter/Space activates the
            hidden file input. */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Drop an OPML file here, or click to browse"
          onClick={() => fileInputRef.current?.click()}
          // WAI-ARIA pattern for role="button": activate Enter on
          // keyDown but Space on keyUp. Some browsers (Firefox)
          // synthesise a click on Space-up for role="button"; if
          // we also fired the picker on Space-down the dialog
          // would open twice. preventDefault on Space-down still
          // suppresses the page-scroll that Space normally
          // triggers.
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              fileInputRef.current?.click();
            } else if (e.key === " ") {
              e.preventDefault();
            }
          }}
          onKeyUp={(e) => {
            if (e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={
            "flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-3 transition-colors " +
            (dragOver
              ? "border-primary bg-primary/5"
              : "hover:border-foreground/30 hover:bg-muted/40")
          }
        >
          <Upload aria-hidden="true" className="size-5 text-muted-foreground" />
          <div className="flex-1 text-left">
            <p className="text-sm font-medium">
              {fileName ? fileName : "Drop an OPML file here, or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground">
              {fileName
                ? `${rows.length} feed${rows.length === 1 ? "" : "s"} parsed — review below.`
                : "Export from Feedly, NetNewsWire, Inoreader, or any reader that supports OPML 2.0."}
            </p>
          </div>
          {rows.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                // Don't trigger the wrapper's onClick file-picker.
                e.stopPropagation();
                clear();
              }}
            >
              <Trash2 className="mr-1.5 size-4" />
              Clear
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".opml,.xml,application/xml,text/xml"
            className="hidden"
            onChange={onFileInput}
          />
        </div>
        <BulkPreview rows={rows} />
      </div>
      <BulkSubmitFooter rows={rows} onClose={onClose} />
    </>
  );
}

/* ── Competitor recommender tab ──────────────────────────────── */

/**
 * Paste a competitor URL → AI proposes 0–12 candidate trusted sources
 * scored with confidence + a one-sentence relevance pitch each.
 * Recommendations are mapped to CreateSourceInput[] with `as:
 * "suggested"` so they land as `status: "suggested"` + `origin:
 * "ai_suggested"` + `trustScore: <AI confidence>` — the operator
 * reviews under the Suggested tab and accepts/rejects per-row via the
 * existing state-machine PATCH (suggested → active or rejected).
 *
 * Why suggested-not-active: half the AI's guesses might be
 * hallucinated handles. Landing them directly in the active pool
 * would accumulate `consecutiveFetchFailures` and pollute the
 * fetcher's working set. Suggested-tab review-before-promote
 * matches the state machine the trusted.ts route was designed for.
 */
function CompetitorTab({ onClose }: { onClose: () => void }) {
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [recs, setRecs] = useState<RecommendedSource[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onRecommend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = competitorUrl.trim();
    if (!trimmed) {
      toast.error("Enter a competitor URL");
      return;
    }
    setLoading(true);
    try {
      const result = await recommendSourcesFromCompetitor(trimmed);
      setRecs(result.recommendations);
      setSummary(result.competitorSummary);
      if (result.recommendations.length === 0) {
        // Empty result is honest — the model couldn't confidently
        // propose anything. Don't surface as an error toast; the
        // empty-state inline copy carries the explanation.
        toast.info("No high-confidence recommendations for this competitor");
      } else {
        toast.success(`Found ${result.recommendations.length} candidate source${result.recommendations.length === 1 ? "" : "s"}`);
      }
    } catch (err) {
      // 402 PAYMENT_REQUIRED would have been intercepted upstream by
      // the FeatureGate (the tab only renders when the feature is
      // unlocked anyway). Other errors surface verbatim from the API.
      const message = err instanceof ApiError ? err.message : "Recommender failed";
      toast.error(message);
      setRecs([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  // Map recommendations → CreateSourceInput with the as/suggestedReason/
  // trustScore fields populated. The shared BulkSubmitFooter uses
  // `createSource` which forwards every field, so the recommender's
  // `reason` and `confidence` flow through to the persisted row's
  // `suggestedReason` and `trustScore` without any glue here.
  const submitRows: CreateSourceInput[] = recs.map((r) => ({
    type: r.type,
    identifier: r.identifier,
    displayName: r.displayName,
    fetchFrequency: r.fetchFrequency,
    as: "suggested",
    suggestedReason: r.reason,
    trustScore: r.confidence,
  }));

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 overflow-auto px-4 pt-4">
        <form onSubmit={onRecommend} className="grid gap-2">
          <Label htmlFor="competitor-url">Competitor URL</Label>
          <div className="flex gap-2">
            <Input
              id="competitor-url"
              value={competitorUrl}
              onChange={(e) => setCompetitorUrl(e.target.value)}
              placeholder="https://acme.io"
              autoComplete="off"
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !competitorUrl.trim()}>
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Finding…
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 size-4" />
                  Find sources
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Paste a competitor or peer brand&apos;s URL — the AI proposes trusted sources grounded in your brand&apos;s sectors and audience. Approved recommendations land in your Suggested tab for one-click review.
          </p>
        </form>

        {summary && (
          <div className="rounded-lg border bg-muted/40 p-3 text-xs">
            <p className="mb-1 font-medium">Competitor read</p>
            <p className="text-muted-foreground">{summary}</p>
          </div>
        )}

        {recs.length > 0 && <CompetitorRecommendationsPreview rows={recs} />}

        {/* Empty-state inline copy — surfaces ONLY after a successful
            run that returned zero. Loading + pre-run states render
            nothing here so the form's helper paragraph stays as the
            single explainer. */}
        {!loading && summary !== null && recs.length === 0 && (
          <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center">
            <p className="text-sm font-medium">No high-confidence recommendations</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The AI couldn&apos;t confidently identify sources scoped to this competitor and your business. Try a closer competitor or refine your business profile so the recommender has more signal.
            </p>
          </div>
        )}
      </div>
      <BulkSubmitFooter
        rows={submitRows}
        onClose={onClose}
        addLabel={
          submitRows.length === 0
            ? "Add to Suggested"
            : `Add ${submitRows.length} to Suggested`
        }
      />
    </>
  );
}

/**
 * Wraps BulkPreview's row layout with per-row reason + confidence
 * chrome. We don't reuse BulkPreview directly because the shared
 * component is intentionally type-agnostic — it sees only
 * CreateSourceInput which doesn't carry the AI's display metadata.
 */
function CompetitorRecommendationsPreview({ rows }: { rows: RecommendedSource[] }) {
  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium">
          {rows.length} {rows.length === 1 ? "recommendation" : "recommendations"}
        </span>
        <span className="text-xs text-muted-foreground">
          Land as Suggested — review before promoting
        </span>
      </div>
      <ul className="max-h-80 divide-y overflow-auto">
        {rows.map((row, i) => (
          <li key={`${row.identifier}-${i}`} className="flex items-start gap-3 px-3 py-2.5">
            <Badge variant="outline" className="mt-0.5 shrink-0 text-[10px]">
              {SOURCE_TYPE_LABEL[row.type]}
            </Badge>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-xs font-medium">{row.displayName}</p>
                <ConfidencePill confidence={row.confidence} />
              </div>
              <p className="truncate font-mono text-[10px] text-muted-foreground" title={row.identifier}>
                {row.identifier}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {row.reason}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Compact confidence indicator. Buckets a 0..1 score into three
 * labels: High (>=0.7), Medium (>=0.55), Low (everything else above
 * the recommender's 0.4 schema floor). Color follows the same
 * success/warning/neutral semantics the rest of the app uses for
 * trust signals.
 *
 * a11y: aria-label combines BOTH the bucket label and the precise
 * percentage so screen readers announce "High confidence, 84%" rather
 * than losing the percentage in a `title=`-attribute that AT users
 * announce inconsistently. The visible bucket label still renders so
 * sighted users get the at-a-glance bucket; AT users get the same
 * bucket plus the underlying number.
 */
function ConfidencePill({ confidence }: { confidence: number }) {
  const { label, classes } =
    confidence >= 0.7
      ? { label: "High", classes: "border-emerald-500/50 text-emerald-700 dark:text-emerald-400" }
      : confidence >= 0.55
        ? { label: "Medium", classes: "border-amber-500/50 text-amber-700 dark:text-amber-400" }
        : { label: "Low", classes: "border-muted-foreground/30 text-muted-foreground" };
  const pct = (confidence * 100).toFixed(0);
  return (
    <Badge
      variant="outline"
      className={`shrink-0 text-[10px] ${classes}`}
      title={`AI confidence: ${pct}%`}
      aria-label={`${label} confidence, ${pct}%`}
    >
      {label}
    </Badge>
  );
}

/* ── Shared bulk preview + submit ────────────────────────────── */

interface BulkOutcome {
  succeeded: number;
  duplicates: number;
  failed: number;
  errors: { identifier: string; message: string }[];
}

/** Run N create-source POSTs in parallel batches of 10. Returns an
 *  aggregate outcome rather than throwing on partial failure — the
 *  UI surfaces "3 added, 1 duplicate, 1 failed" rather than a hard
 *  fail when one row hits a 409. Calls `onProgress` between batches
 *  so the caller can render a progress counter without polling. */
async function bulkCreateSources(
  rows: CreateSourceInput[],
  onProgress?: (done: number, total: number) => void,
): Promise<BulkOutcome> {
  const BATCH = 10;
  const result: BulkOutcome = { succeeded: 0, duplicates: 0, failed: 0, errors: [] };
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const settled = await Promise.allSettled(batch.map((r) => createSource(r)));
    settled.forEach((s, j) => {
      const row = batch[j];
      if (s.status === "fulfilled") {
        result.succeeded += 1;
      } else if (s.reason instanceof ApiError && s.reason.status === 409) {
        result.duplicates += 1;
      } else {
        result.failed += 1;
        const message = s.reason instanceof ApiError ? s.reason.message : "unknown error";
        result.errors.push({ identifier: row.identifier, message });
      }
    });
    onProgress?.(Math.min(i + BATCH, rows.length), rows.length);
  }
  return result;
}

function BulkPreview({ rows }: { rows: CreateSourceInput[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium">
          {rows.length} {rows.length === 1 ? "row" : "rows"} ready
        </span>
        <span className="text-xs text-muted-foreground">All fetch daily</span>
      </div>
      <ul className="max-h-80 divide-y overflow-auto">
        {rows.map((row, i) => (
          <li key={`${row.identifier}-${i}`} className="flex items-center gap-3 px-3 py-2">
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {SOURCE_TYPE_LABEL[row.type]}
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{row.displayName}</p>
              <p className="truncate font-mono text-[10px] text-muted-foreground" title={row.identifier}>
                {row.identifier}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BulkSubmitFooter({
  rows,
  onClose,
  /** Optional override of the primary button's label. Competitor tab
   *  passes "Add N to Suggested" so the button names the lifecycle
   *  the recommendations land in; bulk/opml tabs omit and get the
   *  default "Add N sources". */
  addLabel,
}: {
  rows: CreateSourceInput[];
  onClose: () => void;
  addLabel?: string;
}) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function submit() {
    if (rows.length === 0) return;
    setSubmitting(true);
    setProgress({ done: 0, total: rows.length });
    try {
      const outcome = await bulkCreateSources(rows, (done, total) => setProgress({ done, total }));
      // Refetch even on a partial outcome — any successes need to
      // appear in the listing immediately.
      queryClient.invalidateQueries({ queryKey: ["trusted-sources"] });
      summarize(outcome);
      // Close only when there were no failures. On any failure
      // (including "everything was a duplicate" or hard errors),
      // keep the drawer open so the user can see the rows that
      // didn't land + amend without losing context. Pure-success
      // and pure-success-plus-no-op-duplicate paths close.
      if (outcome.failed === 0 && outcome.succeeded > 0) onClose();
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  function summarize(o: BulkOutcome) {
    const parts: string[] = [];
    if (o.succeeded) parts.push(`${o.succeeded} added`);
    if (o.duplicates) parts.push(`${o.duplicates} already existed`);
    if (o.failed) parts.push(`${o.failed} failed`);
    const summary = parts.join(", ") || "Nothing to add";
    if (o.failed > 0) toast.error(summary);
    else if (o.duplicates > 0 && o.succeeded === 0) toast.warning(summary);
    else toast.success(summary);
    // Surface the first ~3 specific failure messages — useful to
    // diagnose why a row didn't land. Don't dump the full error
    // list (could be 50 rows). The summary toast above already
    // names the count.
    o.errors.slice(0, 3).forEach((e) => {
      toast.error(`${e.identifier}: ${e.message}`);
    });
  }

  const buttonLabel =
    submitting && progress
      ? `Adding ${progress.done} / ${progress.total}…`
      : addLabel ??
        (rows.length === 0
          ? "Add"
          : `Add ${rows.length} source${rows.length === 1 ? "" : "s"}`);

  return (
    <SheetFooter>
      <Button variant="outline" type="button" onClick={onClose} disabled={submitting}>
        Cancel
      </Button>
      <Button onClick={submit} disabled={submitting || rows.length === 0}>
        {submitting ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
        {buttonLabel}
      </Button>
    </SheetFooter>
  );
}
