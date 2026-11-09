"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBusinessHold, useLegalHolds, useThreadHold } from "@/hooks/use-legal-holds";
import {
  businessHoldLine,
  canLiftThreadHold,
  canManageHolds,
  canPlaceThreadHold,
  checkHoldReason,
  checkLiftReason,
  heldBadge,
  heldSince,
  liftConfirmLabel,
  threadLiftWarning,
  businessLiftWarning,
  LIFT_CHECK_FAILED,
  freshListing,
  holdErrorMessage,
  threadTail,
  HOLD_EFFECT,
  HOLD_REASON_HINT,
  HOLD_REASON_MAX,
  LIFT_REASON_HINT,
  reasonCharsRemaining,
  type HeldBy,
} from "@/lib/legal-hold";

/**
 * Legal holds in the Inbox (privacy programme H1). MARKUP ONLY: what is offered, what a reason must be and what each refusal
 * means are in `lib/legal-hold.ts`, where they are tested. The api (`/v1/legal-holds`) is owner/admin only and is the real gate.
 */

/**
 * The form inside the dialog. ★ITS STATE LIVES HERE, in a component that exists only while the dialog is open (Radix unmounts
 * the content on close), so a reason typed and then cancelled is never still there the next time the dialog opens.
 * A PLACE needs a reason; a LIFT takes an optional one.
 */
export function ReasonForm({
  lifting,
  warning,
  confirmLabel,
  pending,
  onCancel,
  onConfirm,
}: {
  lifting: boolean;
  /** Said first, in the destructive colour, when confirming deletes something for good. */
  warning: string | null;
  confirmLabel: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string | null) => void;
}) {
  const [text, setText] = useState("");
  const check = lifting ? checkLiftReason(text) : checkHoldReason(text);
  return (
    <>
      <div className="space-y-2">
        {warning && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {warning}
          </p>
        )}
        {!warning && <p className="text-xs text-muted-foreground">{HOLD_EFFECT}</p>}
        <label className="text-sm font-medium" htmlFor="hold-reason">
          {lifting ? "Reason (optional)" : "Reason"}
        </label>
        <Textarea id="hold-reason" value={text} onChange={(e) => setText(e.target.value)} rows={3} aria-describedby="hold-reason-hint" />
        <p id="hold-reason-hint" className="text-xs text-muted-foreground">
          {lifting ? LIFT_REASON_HINT : HOLD_REASON_HINT} ({reasonCharsRemaining(text)} of {HOLD_REASON_MAX} characters left)
        </p>
        {text.length > 0 && !check.ok && <p className="text-xs text-destructive">{check.problem}</p>}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button variant={warning ? "destructive" : "default"} disabled={!check.ok || pending} onClick={() => check.ok && onConfirm(check.reason)}>
          {pending ? "…" : confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}

/** A dialog that asks for a reason and calls `onConfirm(reason)`. It cannot be dismissed while the request is in flight. */
function ReasonDialog({
  open,
  onOpenChange,
  lifting,
  warning = null,
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lifting: boolean;
  warning?: string | null;
  title: string;
  description: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: (reason: string | null) => void;
}) {
  return (
    // ★NOT DISMISSABLE MID-REQUEST: closing the dialog (Escape, the overlay) while a hold is being placed would leave the
    //  person unsure whether it happened, and a second attempt would meet a conflict.
    <Dialog open={open} onOpenChange={(o) => (pending ? undefined : onOpenChange(o))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ReasonForm lifting={lifting} warning={warning} confirmLabel={confirmLabel} pending={pending} onCancel={() => onOpenChange(false)} onConfirm={onConfirm} />
      </DialogContent>
    </Dialog>
  );
}

/** The badge on a thread: "On legal hold" / "On hold (all conversations)". Nothing when it is not held. */
export function HeldBadge({ held }: { held: HeldBy }) {
  const label = heldBadge(held);
  return label ? <Badge className="bg-warning/15 text-[10px] text-warning-on-tint">{label}</Badge> : null;
}

/**
 * The open thread's hold, as a flow a header can place wherever it likes (Inbox phase 1: a button on a wide screen, an item in the
 * overflow menu on a phone). `available` is false for anyone but an owner or admin, and for a thread held only because the whole
 * business is. `start` opens the dialog (a lift first reads the holds fresh). `dialog` is the dialog itself: render it OUTSIDE any
 * menu, because a menu unmounts its content when an item is chosen and would take the open dialog with it.
 */
export function useThreadHoldFlow({ threadId, held, role }: { threadId: string; held: HeldBy; role: string | null }) {
  // ★THE MODE IS FROZEN WHEN THE DIALOG OPENS. Derived live from `held`, a refetch after a refused action (someone else lifted
  //  it) would turn an open "Lift hold" dialog into a "Keep this conversation" one, with the typed text still in it.
  const [mode, setMode] = useState<"place" | "lift" | null>(null);
  // ★LIKEWISE FROZEN: whether this lift deletes the conversation is read when the dialog opens, so a refetch cannot swap the
  //  warning (or the button's name) under a person who is already reading it.
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);
  const hold = useThreadHold();
  const holds = useLegalHolds(canManageHolds(role));
  const allowed = canManageHolds(role);
  const canLift = canLiftThreadHold(held);
  // Held because the business is (lifted there), or not known (an api that predates holds): nothing to offer.
  const available = allowed && (canLift || canPlaceThreadHold(held) || mode !== null);
  const lifting = (mode ?? (canLift ? "lift" : "place")) === "lift";
  const start = async () => {
    if (!canLift) return setMode("place");
    // ★READ FRESH, NOT FROM A 30-SECOND-OLD CACHE: an uninstall or a customer's erasure can land since the last fetch, and the
    //  lift would then delete a conversation the dialog called ordinary. If the check cannot be made the lift is not offered.
    const fresh = await holds.refetch();
    const warning = threadLiftWarning(freshListing(fresh), threadId);
    if (warning === undefined) return void toast.error(LIFT_CHECK_FAILED);
    setDeleteWarning(warning);
    setMode("lift");
  };
  const dialog = available ? (
    <ReasonDialog
      open={mode !== null}
      onOpenChange={(o) => !o && setMode(null)}
      lifting={lifting}
      warning={lifting ? deleteWarning : null}
      title={lifting ? (deleteWarning ? "Lift the hold and delete?" : "Lift the legal hold?") : "Keep this conversation (legal hold)"}
      description={
        lifting && deleteWarning
          ? "This conversation is waiting to be erased. Read the warning before you confirm."
          : lifting
          ? "The conversation goes back to the normal 180 days after its last message (at least 7 days from now)."
          : "Use this when you must keep a conversation for a legal reason."
      }
      confirmLabel={lifting ? liftConfirmLabel(deleteWarning, "Lift hold") : "Keep this conversation"}
      pending={hold.isPending}
      onConfirm={(reason) =>
        hold.mutate(
          { threadId, action: lifting ? "lift" : "place", ...(reason ? { reason } : {}) },
          {
            onSuccess: () => {
              setMode(null);
              toast.success(lifting ? "Hold lifted." : "This conversation is now kept.");
            },
            onError: (e: Error) => toast.error(holdErrorMessage(e, lifting ? "lift" : "place")),
          },
        )
      }
    />
  ) : null;
  return { available, label: canLift ? "Lift hold" : "Keep (legal hold)", start, dialog };
}

/** "Keep (legal hold)" / "Lift hold" for the open thread. Renders nothing for anyone but an owner or admin. */
export function ThreadHoldControl({ threadId, held, role }: { threadId: string; held: HeldBy; role: string | null }) {
  const flow = useThreadHoldFlow({ threadId, held, role });
  if (!flow.available) return null;
  return (
    <>
      <Button size="sm" variant="outline" onClick={flow.start}>
        {flow.label}
      </Button>
      {flow.dialog}
    </>
  );
}

/** The business-wide hold and the list of held conversations. Owner/admin only. */
export function HoldsCard({ role, onOpenThread }: { role: string | null; onOpenThread: (threadId: string) => void }) {
  const allowed = canManageHolds(role);
  const holds = useLegalHolds(allowed);
  const business = useBusinessHold();
  const [dialog, setDialog] = useState<"place" | "lift" | null>(null);
  // The mode the dialog was LAST opened in, kept for rendering: when it closes `dialog` is null while it animates out, and the
  // content must not flip to the opposite action for that moment. (State, not a ref: a ref is not read during render.)
  const [shown, setShown] = useState<"place" | "lift">("place");
  // How many conversations the business lift deletes, read when the dialog opens and frozen like `shown`.
  const [deleting, setDeleting] = useState<string | null>(null);
  const openDialog = async (mode: "place" | "lift") => {
    if (mode === "lift") {
      // ★READ FRESH (see the thread lift): a stale count would call a mass deletion an ordinary lift.
      const warning = businessLiftWarning(freshListing(await holds.refetch()));
      if (warning === undefined) return void toast.error(LIFT_CHECK_FAILED);
      setDeleting(warning);
    } else setDeleting(null);
    setShown(mode);
    setDialog(mode);
  };
  if (!allowed) return null;
  const data = holds.data;
  return (
    <Card className="mb-4 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Legal holds</p>
          <p className="text-xs text-muted-foreground">
            Conversations are deleted 180 days after their last message. A conversation on hold is kept until you lift the hold.
          </p>
        </div>
        {data && (
          <Button size="sm" variant="outline" onClick={() => openDialog(data.business ? "lift" : "place")}>
            {data.business ? "Lift business hold" : "Hold all conversations"}
          </Button>
        )}
      </div>
      {holds.isError && <p className="mt-2 text-xs text-destructive">Couldn&apos;t load the legal holds.</p>}
      {data?.business && (
        <p className="mt-2 text-xs">
          <span className="font-medium">All conversations are on hold.</span> {businessHoldLine(data.business)}
        </p>
      )}
      {data && data.conversations.length === 0 && !data.business && (
        <p className="mt-2 text-xs text-muted-foreground">Nothing is on hold.</p>
      )}
      {data && data.conversations.length > 0 && (
        <ul className="mt-2 space-y-1">
          {data.conversations.map((c) => (
            <li key={c.threadId} className="flex items-baseline justify-between gap-2 text-xs">
              <button className="min-w-0 truncate text-left underline-offset-2 hover:underline" onClick={() => onOpenThread(c.threadId)}>
                {c.reason}
              </button>
              <span className="shrink-0 text-muted-foreground">
                {threadTail(c.threadId)} · {heldSince(c.heldAt)}
                {c.eraseDeferred ? " · erasure waiting" : ""}
              </span>
            </li>
          ))}
          {data.truncated && <li className="text-xs text-muted-foreground">More conversations are on hold than are listed here.</li>}
        </ul>
      )}
      <ReasonDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        lifting={shown === "lift"}
        warning={shown === "lift" ? deleting : null}
        title={shown === "lift" ? (deleting ? "Lift the hold and delete?" : "Lift the business-wide hold?") : "Keep all conversations (legal hold)"}
        description={
          shown === "lift" && deleting
            ? "Some held conversations are waiting to be erased. Read the warning before you confirm."
            : shown === "lift"
            ? "Conversations held only by this go back to the normal 180 days; one you held by name stays held."
            : "Every current conversation, and every new one within the hour, is kept until you lift this."
        }
        confirmLabel={shown === "lift" ? liftConfirmLabel(deleting, "Lift business hold") : "Hold all conversations"}
        pending={business.isPending}
        onConfirm={(reason) => {
          const action = shown;
          business.mutate(
            { action, ...(reason ? { reason } : {}) },
            {
              onSuccess: () => {
                setDialog(null);
                toast.success(action === "place" ? "All conversations are now kept." : "Business hold lifted.");
              },
              onError: (e: Error) => toast.error(holdErrorMessage(e, action)),
            },
          );
        }}
      />
    </Card>
  );
}
