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
  holdErrorMessage,
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
function ReasonForm({
  lifting,
  confirmLabel,
  pending,
  onCancel,
  onConfirm,
}: {
  lifting: boolean;
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
        <p className="text-xs text-muted-foreground">{HOLD_EFFECT}</p>
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
        <Button disabled={!check.ok || pending} onClick={() => check.ok && onConfirm(check.reason)}>
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
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lifting: boolean;
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
        <ReasonForm lifting={lifting} confirmLabel={confirmLabel} pending={pending} onCancel={() => onOpenChange(false)} onConfirm={onConfirm} />
      </DialogContent>
    </Dialog>
  );
}

/** The badge on a thread: "On legal hold" / "On hold (all conversations)". Nothing when it is not held. */
export function HeldBadge({ held }: { held: HeldBy }) {
  const label = heldBadge(held);
  return label ? <Badge className="bg-warning/15 text-[10px] text-warning-on-tint">{label}</Badge> : null;
}

/** "Keep (legal hold)" / "Lift hold" for the open thread. Renders nothing for anyone but an owner or admin. */
export function ThreadHoldControl({ threadId, held, role }: { threadId: string; held: HeldBy; role: string | null }) {
  const [open, setOpen] = useState(false);
  const hold = useThreadHold();
  if (!canManageHolds(role)) return null;
  const lifting = canLiftThreadHold(held);
  // Held because the business is (lifted there), or not known (an api that predates holds): nothing to offer.
  if (!lifting && !canPlaceThreadHold(held)) return null;
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        {lifting ? "Lift hold" : "Keep (legal hold)"}
      </Button>
      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        lifting={lifting}
        title={lifting ? "Lift the legal hold?" : "Keep this conversation (legal hold)"}
        description={
          lifting
            ? "The conversation goes back to the normal 180 days after its last message (at least 7 days from now)."
            : "Use this when you must keep a conversation for a legal reason."
        }
        confirmLabel={lifting ? "Lift hold" : "Keep this conversation"}
        pending={hold.isPending}
        onConfirm={(reason) =>
          hold.mutate(
            { threadId, action: lifting ? "lift" : "place", ...(reason ? { reason } : {}) },
            {
              onSuccess: () => {
                setOpen(false);
                toast.success(lifting ? "Hold lifted." : "This conversation is now kept.");
              },
              onError: (e: Error) => toast.error(holdErrorMessage(e, lifting ? "lift" : "place")),
            },
          )
        }
      />
    </>
  );
}

/** The business-wide hold and the list of held conversations. Owner/admin only. */
export function HoldsCard({ role, onOpenThread }: { role: string | null; onOpenThread: (threadId: string) => void }) {
  const allowed = canManageHolds(role);
  const holds = useLegalHolds(allowed);
  const business = useBusinessHold();
  const [dialog, setDialog] = useState<"place" | "lift" | null>(null);
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
          <Button size="sm" variant="outline" onClick={() => setDialog(data.business ? "lift" : "place")}>
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
                {heldSince(c.heldAt)}
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
        lifting={dialog === "lift"}
        title={dialog === "lift" ? "Lift the business-wide hold?" : "Keep all conversations (legal hold)"}
        description={
          dialog === "lift"
            ? "Conversations held only by this go back to the normal 180 days; one you held by name stays held."
            : "Every current conversation, and every new one within the hour, is kept until you lift this."
        }
        confirmLabel={dialog === "lift" ? "Lift business hold" : "Hold all conversations"}
        pending={business.isPending}
        onConfirm={(reason) => {
          const action = dialog === "lift" ? "lift" : "place";
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
