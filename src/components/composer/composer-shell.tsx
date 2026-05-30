"use client";

/**
 * <ComposerShell/> — the shared presentational frame every publish/edit
 * composer mounts so the platform looks uniform (X, LinkedIn, and the
 * strategist WriteTab today; Beehiiv/calendar later).
 *
 * It is a LAYOUT FRAME, not a controller: it owns NO state, no hooks,
 * no network, no scheduler wiring. Each host keeps its own state and
 * passes its platform-specific UI in as slots. This is deliberate — it
 * means adopting the shell cannot change a composer's behavior, only
 * its surrounding chrome + spacing.
 *
 * What the shell renders itself (the only thing it owns):
 *   - the `space-y-4` outer column,
 *   - the schedule-mode wrapper (the "Schedule this {noun}" header +
 *     "Back to editing" button, then the host's <SchedulerComposer/>),
 *   - the TOP CHROME row (voice-card chip + "Actions" command-palette
 *     trigger) — OPTIONAL: omitted entirely when a surface passes
 *     neither `voiceCard` nor `onOpenPalette` (e.g. the strategist
 *     editor, which has no voice chip / palette — so no empty row is
 *     ever rendered),
 *   - the bottom action-bar wrapper (statusSlot left, actionsSlot
 *     right) — border-less so a host can bring its own divider.
 *
 * Everything platform-specific (textareas, thread builder, author
 * pickers, policy chip, image rail, the actual action <Button>s,
 * DraftSaver, char counter, emoji trigger, command palette node) is a
 * slot — rendered by the host so its wiring is untouched.
 */

import type { ReactNode } from "react";
import { ArrowLeft, CalendarClock, Command as CommandIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VoiceCardPreview } from "./voice-card-preview";
import type { VoiceCardSummary } from "./types";

/** Schedule-mode config. When `mode === "schedule"` the shell renders
 *  the shared header + the host-provided scheduler node and ignores
 *  every other slot. The host still owns <SchedulerComposer/> (its
 *  props, its `key` remount, its onScheduled) and passes it in. */
export interface ComposerScheduleView {
  /** Noun for the header copy: "post" | "tweet" | "thread" | … */
  noun: string;
  /** Host-rendered <SchedulerComposer/> (keyed + wired by the host). */
  scheduler: ReactNode;
  /** Return to compose mode. */
  onBack: () => void;
}

export interface ComposerShellProps {
  /** "compose" renders chrome + body; "schedule" renders scheduleView. */
  mode: "compose" | "schedule";
  /** Required when mode === "schedule". */
  scheduleView?: ComposerScheduleView;

  // ── TOP CHROME (optional; shell renders the row when present) ──────
  /** Voice-card chip summary. When BOTH this and `onOpenPalette` are
   *  omitted, the shell renders NO chrome row at all. */
  voiceCard?: VoiceCardSummary | null;
  /** Opens the command palette (shell renders the "Actions" button).
   *  Omit (with voiceCard) to drop the chrome row entirely. */
  onOpenPalette?: () => void;
  /** Controls rendered ABOVE the chrome row (e.g. LinkedIn's author +
   *  visibility grid). Pure passthrough. */
  headerSlot?: ReactNode;
  /** Rendered BETWEEN the chrome row and the toolbar (e.g. X's
   *  reply/quote reference chip; LinkedIn's VoiceCardPanel) so slot
   *  order matches the pre-shell layout exactly. */
  subHeaderSlot?: ReactNode;
  /** The AI compose toolbar (host-owned — it holds the text + handler).
   *  Shell slots it directly under the chrome so spacing is uniform. */
  toolbarSlot?: ReactNode;

  // ── BODY (host-owned editable surface) ────────────────────────────
  /** The editable body. Optional because schedule mode renders only
   *  the scheduler, not the body. */
  children?: ReactNode;

  // ── BOTTOM CHROME ─────────────────────────────────────────────────
  /** Left of the action bar: char counter + draft-saver (host renders;
   *  shell only positions). Omit when a host has none. */
  statusSlot?: ReactNode;
  /** Right of the action bar: the primary action buttons (Schedule/
   *  Publish, or Save/Regenerate/Finalize). Host renders the real
   *  <Button>s so every handler / disabled / aria-busy is unchanged. */
  actionsSlot?: ReactNode;
  /** Inline feedback banner under the action bar (host renders). */
  footerSlot?: ReactNode;
  /** Command-palette node (host renders; shell places it last). */
  paletteSlot?: ReactNode;
  /** Draw a top divider above the action bar (X's `border-t pt-3`
   *  footer-actions look). Off by default (LinkedIn groups its
   *  counter+saver into statusSlot with no divider). */
  actionsBordered?: boolean;

  className?: string;
}

export function ComposerShell({
  mode,
  scheduleView,
  voiceCard,
  onOpenPalette,
  headerSlot,
  subHeaderSlot,
  toolbarSlot,
  children,
  statusSlot,
  actionsSlot,
  footerSlot,
  paletteSlot,
  actionsBordered,
  className,
}: ComposerShellProps) {
  // ── Schedule view ───────────────────────────────────────────────
  if (mode === "schedule" && scheduleView) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center justify-between gap-3 border-b pb-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarClock className="size-4 text-primary" />
            Schedule this {scheduleView.noun}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={scheduleView.onBack}
            className="gap-1.5"
          >
            <ArrowLeft className="size-3.5" /> Back to editing
          </Button>
        </div>
        {scheduleView.scheduler}
      </div>
    );
  }

  // ── Compose view ────────────────────────────────────────────────
  const showChrome = voiceCard !== undefined || !!onOpenPalette;

  return (
    <div className={cn("space-y-4", className)}>
      {headerSlot}

      {showChrome && (
        <div className="flex items-center justify-between gap-2">
          <VoiceCardPreview voiceCard={voiceCard} />
          {onOpenPalette && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onOpenPalette}
              className="gap-1.5 text-xs text-muted-foreground"
            >
              <CommandIcon className="size-3.5" /> Actions
            </Button>
          )}
        </div>
      )}

      {subHeaderSlot}
      {toolbarSlot}

      {children}

      {(statusSlot || actionsSlot) && (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3",
            actionsBordered && "border-t pt-3",
          )}
        >
          {/* Only render the left cell when there's status content, so a
              status-less bar (X) collapses to a clean right-aligned row
              rather than an empty flex child. */}
          {statusSlot ? <div className="flex items-center gap-3">{statusSlot}</div> : null}
          <div className="flex items-center gap-2">{actionsSlot}</div>
        </div>
      )}

      {footerSlot}
      {paletteSlot}
    </div>
  );
}
