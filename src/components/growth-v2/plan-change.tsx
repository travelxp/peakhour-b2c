"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePatchRules, type MandatePatch, type RulesResponse } from "@/lib/api/growth-v2";
import { formatDate } from "@/lib/growth-v2-figure";
import { SENT_FOR_CONFIRMATION, patchErrorMessage } from "@/lib/growth-v2-rules";

/**
 * A change to the plan, confirmed on WhatsApp (plan 2.1; PL-3's Goals page and the Guardrails ceiling). ONE flow for every plan
 * change: the form builds a `mandate` patch, `PATCH /rules` stores it pending and sends the link, and this says so. Nothing
 * changes until the merchant opens the link and enters the code (`/growth/confirm/[token]`).
 */
export function PlanChangeDialog({
  title,
  description = "We send a link to your WhatsApp. Your plan changes only when you open it and enter the code.",
  build,
  onClose,
  submitLabel = "Send for confirmation",
  children,
}: {
  title: string;
  description?: string;
  /** The patch the form says, a sentence when it cannot be sent, or undefined when nothing changed. */
  build: () => MandatePatch | { error: string } | undefined;
  onClose: () => void;
  submitLabel?: string;
  children: React.ReactNode;
}) {
  const [error, setError] = useState<string>();
  const patch = usePatchRules();
  const sent = patch.isSuccess && patch.data.mandateChange !== undefined;
  // A 200 that started no change leaves nothing to wait for: say so rather than sit there looking dead.
  const notSent = patch.isSuccess && !sent;

  function submit() {
    const p = build();
    if (p === undefined) return setError("Nothing is different from your plan.");
    if ("error" in p) return setError(p.error);
    setError(undefined);
    patch.mutate({ mandate: p });
  }

  return (
    <Dialog open onOpenChange={(o) => (o ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {sent ? (
          <p role="status" className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
            {SENT_FOR_CONFIRMATION}
          </p>
        ) : (
          <div className="grid gap-4">
            {children}
            {error || patch.isError || notSent ? (
              <p role="alert" className="text-sm text-destructive-on-tint">
                {error ?? (notSent ? "The change was not sent. Check your WhatsApp number in Settings and try again." : patchErrorMessage(patch.error))}
              </p>
            ) : null}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {sent ? "Close" : "Cancel"}
          </Button>
          {sent ? null : (
            <Button type="button" onClick={submit} disabled={patch.isPending}>
              {submitLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A plan change waiting for its link and code; the same note on Guardrails and Goals. */
export function PendingChangeNote({ change }: { change: NonNullable<RulesResponse["pendingChange"]> }) {
  return (
    <div role="status" className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm">
      <b>A change is waiting for your confirmation.</b>
      <p className="mt-0.5">{change.summary}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Until you confirm it, your plan is exactly as it was. The request expires on {formatDate(change.expiresAt)}.</p>
    </div>
  );
}
