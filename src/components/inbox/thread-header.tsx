"use client";

import type { ReactNode } from "react";
import { ChevronLeft, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { HeldBadge } from "@/components/inbox/legal-hold";
import { ChannelChip, StatusPill, TestChip } from "@/components/inbox/inbox-badges";
import type { Channel, InboxState } from "@/lib/inbox-view";

type HeldBy = Parameters<typeof HeldBadge>[0]["held"];

/**
 * The open conversation's header (Inbox phase 1; Mark done, Return to AI and the customer toggle, phase 2).
 *
 * ★MADE TO FIT 375px. The title is the one thing that shrinks (`min-w-0 flex-1 truncate`); the actions are `shrink-0` and there
 * are at most TWO of them on a phone: the main action (Mark done / Reopen, or Return to AI when a person holds the conversation)
 * and a "More" menu holding Customer, Keep (legal hold), Export and Delete this customer's data. From `lg` the rest return as
 * buttons beside the main action. A back button shows only below `lg`, where the list and the
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
  state,
  test,
  held,
  windowBadge,
  onBack,
  hold,
  canExport,
  exporting,
  onExport,
  handover,
  done,
  customer,
  onDeleteContact,
}: {
  title: string;
  channel: Channel;
  status: string;
  needsYou: boolean;
  /** Open / Needs you / Done (Inbox phase 2). */
  state?: InboxState;
  /** The merchant's own "Test on your store" chat. */
  test?: boolean;
  held: HeldBy;
  windowBadge?: ReactNode;
  onBack: () => void;
  /** From `useThreadHoldFlow`; the caller renders `hold.dialog`. */
  hold: { available: boolean; label: string; start: () => void };
  canExport: boolean;
  exporting: boolean;
  onExport: () => void;
  /** "Return to AI" on a conversation a person holds. Absent otherwise, and for a storefront chat (nobody can be handed a conversation they cannot reply to). */
  handover?: { label: string; variant: "default" | "outline"; pending: boolean; disabled: boolean; onClick: () => void } | null;
  /** "Mark done" / "Reopen"; absent for a viewer. */
  done?: { label: string; pending: boolean; disabled: boolean; onClick: () => void } | null;
  /** Shows the customer panel below `xl`, where it is not beside the conversation. */
  customer?: { shown: boolean; onToggle: () => void } | null;
  /** "Delete this customer's data" (owner and admin, WhatsApp); the caller renders the confirmation. */
  onDeleteContact?: (() => void) | null;
}) {
  const hasMore = hold.available || canExport || Boolean(onDeleteContact) || Boolean(customer);
  return (
    <div className="flex items-center gap-2 border-b p-3" data-testid="thread-header">
      <Button variant="ghost" size="icon-sm" className="-ml-1 shrink-0 lg:hidden" aria-label="Back to conversations" onClick={onBack}>
        <ChevronLeft className="size-5" />
      </Button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <ChannelChip channel={channel} />
          {test && <TestChip />}
          <StatusPill status={status} needsYou={needsYou} {...(state ? { state } : {})} />
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
        {done && (
          <Button size="sm" variant={handover ? "ghost" : "outline"} disabled={done.disabled} onClick={done.onClick}>
            {done.pending ? "…" : done.label}
          </Button>
        )}
        {hasMore && (
          <div className="hidden items-center gap-2 lg:flex" data-testid="header-actions-wide">
            {customer && (
              <Button size="sm" variant="ghost" className="xl:hidden" onClick={customer.onToggle}>
                {customer.shown ? "Conversation" : "Customer"}
              </Button>
            )}
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
            {onDeleteContact && (
              <Button size="sm" variant="ghost" className="text-destructive" onClick={onDeleteContact}>
                Delete customer data
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
              {customer && (
                <DropdownMenuItem className="xl:hidden" onSelect={customer.onToggle}>
                  {customer.shown ? "Back to the conversation" : "Customer details"}
                </DropdownMenuItem>
              )}
              {hold.available && <DropdownMenuItem onSelect={() => hold.start()}>{hold.label}</DropdownMenuItem>}
              {canExport && (
                <DropdownMenuItem disabled={exporting} onSelect={onExport}>
                  Export this conversation
                </DropdownMenuItem>
              )}
              {onDeleteContact && (
                <DropdownMenuItem className="text-destructive" onSelect={onDeleteContact}>
                  Delete this customer&apos;s data
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
