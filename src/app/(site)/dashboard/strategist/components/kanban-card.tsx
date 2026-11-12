"use client";

import { useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Sparkles, GripVertical, Newspaper } from "lucide-react";
import { IdeaCardActions } from "./idea-card-actions";

/** Publisher host for a source URL: lowercased, leading www. stripped. */
function hostOf(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export interface PipelineIdea {
  _id: string;
  title: string;
  description?: string;
  status: string;
  starred?: boolean;
  source?: string;
  sector?: string;
  targetAudience?: string;
  contentType?: string;
  angle?: string;
  aiScore?: number;
  channels?: string[];
  priority?: number;
  targetDate?: string;
  scheduledAt?: string;
  brief?: { title?: string; generatedAt?: string };
  content?: { subject?: string; wordCount?: number; version?: number; lastEditedAt?: string };
  /** News Mode: the fresh stories this idea was built from (primary first).
   *  Present on News Strategist / Wire Desk ideas; absent elsewhere. */
  sourceProvenance?: {
    externalUrl?: string;
    snippet?: string;
    capturedAt?: string;
    freshnessClass?: string;
    contribution?: string;
  }[];
  /** News Mode: journalist composite (0-100). */
  recommendationStrength?: number;
  recommendationTags?: string[];
  review?: { verdict?: string; notes?: string };
  publishing?: { beehiivPostId?: string; beehiivUrl?: string };
  createdAt?: string;
  updatedAt?: string;
}

/** Map status to pipeline step progress */
const STATUS_PROGRESS: Record<string, number> = {
  brainstorm: 0,
  planned: 1,
  brief_ready: 2,
  writing: 3,
  in_progress: 3,
  review: 4,
  approved: 4,
  scheduled: 5,
  published: 5,
};
const TOTAL_STEPS = 5;

function getPriorityLabel(score?: number): { label: string; className: string } | null {
  if (score == null) return null;
  if (score >= 8) return { label: "High", className: "bg-destructive/15 text-destructive-on-tint" };
  if (score >= 6) return { label: "Medium", className: "bg-warning/15 text-warning-on-tint" };
  return { label: "Low", className: "bg-muted text-muted-foreground" };
}

/**
 * The card's visual content, with no dnd wiring.
 *
 * Shared by the in-flow <KanbanCard> and the <DragOverlay> preview, so the
 * overlay does not have to render <KanbanCard> itself. Doing that would call
 * useSortable with the same id as the card still mounted in the column,
 * registering a second node under one key in dnd-kit's registry, and would
 * carry a router.push onClick onto an element that only exists mid-drag.
 *
 * To be accurate about the stakes: measured against @dnd-kit/core 6.3.1 the
 * duplicate registration does not actually break drops — collision detection
 * still resolves correctly and the overlay's own transform stays empty. What
 * it does cost is a duplicated role/tabIndex/aria-describedby on two nodes
 * and a second IdeaCardActions mounted for the length of every drag. This
 * split is hygiene against a real hazard, not a fix for an observed bug.
 */
function KanbanCardBody({
  idea,
  onChanged,
  dragHandle,
}: {
  idea: PipelineIdea;
  onChanged?: () => void;
  /** The interactive grip (a real button carrying the dnd listeners). Absent on the overlay clone, which shows an inert cue. */
  dragHandle?: React.ReactNode;
}) {
  const priority = getPriorityLabel(idea.aiScore);
  const progress = STATUS_PROGRESS[idea.status] ?? 0;
  const progressPct = Math.round((progress / TOTAL_STEPS) * 100);

  return (
    <>
      {/* Title row. The grip is the ONLY drag handle: a card that was itself
          role=button and also held the star/delete buttons was a nested
          interactive control (axe nested-interactive). */}
      <div className="flex items-start gap-1.5">
        {dragHandle ?? (
          <span aria-hidden className="mt-0.5 text-muted-foreground">
            <GripVertical className="size-3.5" />
          </span>
        )}
        <h4 className="flex-1 text-sm font-medium leading-snug line-clamp-2">
          {idea.title}
        </h4>
        {idea.source === "ai_suggested" && (
          <Sparkles className="size-3 shrink-0 text-warning mt-0.5" />
        )}
        {/* Star/Delete — always visible when starred (shows the pin), else
            revealed on hover like the drag handle. */}
        <div
          // Keep clicks on the star/delete buttons from opening the card.
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "shrink-0 transition-opacity",
            idea.starred ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          <IdeaCardActions
            ideaId={idea._id}
            title={idea.title}
            starred={!!idea.starred}
            onChanged={() => onChanged?.()}
          />
        </div>
      </div>

      {/* Tags + priority row */}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {priority && (
          <Badge variant="secondary" className={cn("h-5 px-1.5 text-micro font-medium border-0", priority.className)}>
            {priority.label}
          </Badge>
        )}
        {idea.sector && (
          <Badge variant="outline" className="h-5 px-1.5 text-micro">
            {idea.sector}
          </Badge>
        )}
      </div>

      {/* News Mode: source provenance — the credible stories behind a
          fact-first idea. Primary publisher links out; the rest collapse to a
          count. Shown only for ideas that carry sources. stopPropagation keeps
          the link from triggering the card's drag/open behaviour. */}
      {idea.sourceProvenance && idea.sourceProvenance.length > 0 && (() => {
        const total = idea.sourceProvenance.length;
        // Link the first source that actually has a usable host — provenance[0]
        // is usually the primary, but mixed-stream ideas can have an
        // internal-only (sourceId, no URL) entry first.
        const linkSource = idea.sourceProvenance.find((p) => hostOf(p.externalUrl));
        const host = hostOf(linkSource?.externalUrl);
        const breaking = idea.sourceProvenance.some((p) => p.freshnessClass === "breaking");
        return (
          <div
            className="mt-2 flex flex-wrap items-center gap-1 text-micro text-muted-foreground"
            // Keep the whole sources row inert to the card's drag + click-to-open.
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <Newspaper className="size-3 shrink-0" aria-hidden />
            {host && linkSource?.externalUrl ? (
              <a
                href={linkSource.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="max-w-[150px] truncate underline decoration-dotted hover:text-foreground"
                title={linkSource.externalUrl}
              >
                {host}
              </a>
            ) : (
              <span>{total} source{total > 1 ? "s" : ""}</span>
            )}
            {host && total > 1 && <span>+{total - 1} more</span>}
            {breaking && (
              <Badge variant="secondary" className="h-4 px-1 text-micro font-medium border-0 bg-destructive/15 text-destructive-on-tint">
                Breaking
              </Badge>
            )}
            {typeof idea.recommendationStrength === "number" && (
              <span className="ml-auto tabular-nums" title="Journalist relevance score">
                {idea.recommendationStrength}/100
              </span>
            )}
          </div>
        );
      })()}

      {/* Progress bar + metrics footer */}
      <div className="mt-2.5 space-y-1.5">
        <div className="flex items-center justify-between text-micro text-muted-foreground">
          <span>{progress}/{TOTAL_STEPS} steps</span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </>
  );
}

/** Presentational clone for <DragOverlay>. Matches the in-flow card's chrome. */
export function KanbanCardPreview({ idea }: { idea: PipelineIdea }) {
  return (
    <div className="group cursor-grabbing rounded-lg border bg-card p-3 shadow-lg ring-2 ring-primary/20">
      <KanbanCardBody idea={idea} />
    </div>
  );
}

export function KanbanCard({ idea, onChanged }: { idea: PipelineIdea; onChanged?: () => void }) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: idea._id, data: { idea } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };


  // Dragging starts from the grip button only. Clicking anywhere else on the
  // card opens it; the pointer-down position guards against navigating at the
  // end of a drag (a real drag moves >8px, the sensor's activation distance).
  const downPos = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      ref={setNodeRef}
      style={style}
      onPointerDownCapture={(e) => { downPos.current = { x: e.clientX, y: e.clientY }; }}
      onClick={(e) => {
        const d = downPos.current;
        if (d && (Math.abs(e.clientX - d.x) > 8 || Math.abs(e.clientY - d.y) > 8)) return; // was a drag
        router.push(`/dashboard/strategist/${idea._id}`);
      }}
      className={cn(
        "group cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition-all duration-150",
        "hover:shadow-md hover:border-primary/20",
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary/20",
      )}
    >
      <KanbanCardBody
        idea={idea}
        onChanged={onChanged}
        dragHandle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Drag ${idea.title}`}
            onClick={(e) => e.stopPropagation()}
            className="-ml-1 mt-0.5 shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
          >
            <GripVertical className="size-3.5" aria-hidden />
          </button>
        }
      />
    </div>
  );
}
