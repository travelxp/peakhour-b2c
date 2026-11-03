"use client";

import type { ReactNode } from "react";
import { ChevronLeft, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { HeldBadge } from "@/components/inbox/legal-hold";
import { ChannelChip, StatusPill } from "@/components/inbox/inbox-badges";
import type { Channel } from "@/lib/inbox-view";

type HeldBy = Parameters<typeof HeldBadge>[0]["held"];

/**
 * The open conversation's header (Inbox phase 1).
 *
 * ★MADE TO FIT 375px. The title is the one thing that shrinks (`min-w-0 flex-1 truncate`); the actions are `shrink-0` and there
 * are at most TWO of them on a phone: the main action (Take over / Return to AI) and a "More" menu holding Keep (legal hold) and
 * Export. From `lg` the two return as buttons beside the main action. A back button shows only below `lg`, where the list and the
 * conversation are separate views.
 *
 * The hold dialog is rendered by the caller, OUTSIDE the menu: a menu unmounts its content when an item is chosen and would take
 * the open dialog with it.
 */
export function ThreadHeader({
  title,
  channel,
  status,
  needsYou,
  held,
  windowBadge,
  onBack,
  hold,
  canExport,
  exporting,
  onExport,
  handover,
}: {
  title: string;
  channel: Channel;
  status: string;
  needsYou: boolean;
  held: HeldBy;
  windowBadge?: ReactNode;
  onBack: () => void;
  /** From `useThreadHoldFlow`; the caller renders `hold.dialog`. */
  hold: { available: boolean; label: string; start: () => void };
  canExport: boolean;
  exporting: boolean;
  onExport: () => void;
  /** Absent for a storefront chat: nobody can be handed a conversation they cannot reply to. */
  handover?: { label: string; variant: "default" | "outline"; pending: boolean; disabled: boolean; onClick: () => void } | null;
}) {
  const hasMore = hold.available || canExport;
  return (
    <div className="flex items-center gap-2 border-b p-3" data-testid="thread-header">
      <Button variant="ghost" size="icon-sm" className="-ml-1 shrink-0 lg:hidden" aria-label="Back to conversations" onClick={onBack}>
        <ChevronLeft className="size-5" />
      </Button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <ChannelChip channel={channel} />
          <StatusPill status={status} needsYou={needsYou} />
          <HeldBadge held={held} />
          {windowBadge}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {handover && (
          <Button size="sm" variant={handover.variant} disabled={handover.disabled} onClick={handover.onClick}>
            {handover.pending ? "…" : handover.label}
          </Button>
        )}
        {hasMore && (
          <div className="hidden items-center gap-2 lg:flex" data-testid="header-actions-wide">
            {hold.available && (
              <Button size="sm" variant="outline" onClick={hold.start}>
                {hold.label}
              </Button>
            )}
            {canExport && (
              <Button size="sm" variant="ghost" disabled={exporting} onClick={onExport}>
                Export
              </Button>
            )}
          </div>
        )}
        {hasMore && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm" className="lg:hidden" aria-label="More actions" data-testid="header-more">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {hold.available && <DropdownMenuItem onSelect={() => hold.start()}>{hold.label}</DropdownMenuItem>}
              {canExport && (
                <DropdownMenuItem disabled={exporting} onSelect={onExport}>
                  Export this conversation
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
