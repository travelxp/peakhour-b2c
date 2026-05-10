"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * RejectReasonDialog — shared molecule for the "reject this thing,
 * tell us why" pattern. Used today by the Trusted Sources reject
 * action; built generic so future surfaces (rejecting AI-suggested
 * voice cards, rejecting recommended ad creatives) reuse it.
 *
 * UX: the user picks a canned reason from a Select, optionally
 * appends free-text detail in a Textarea. Submit emits the chosen
 * label + (if present) the free-text — the caller decides how to
 * combine them into the reason string sent to the backend (default:
 * "{label}: {detail}" or just "{label}" / "{detail}" depending on
 * what's provided). The dialog has no opinion on the API contract.
 *
 * Contract notes:
 *   • `open` / `onOpenChange` — controlled. Always-controlled because
 *     reject-this-row is always row-scoped and the parent already
 *     tracks which row the user clicked.
 *   • Provide either `cannedReasons` (the dropdown shows them) or
 *     pass an empty array and rely on free-text only.
 *   • `onSubmit(reason)` is called with the final string. Returning a
 *     promise lets the dialog show a spinner while the network call
 *     is in flight; resolving auto-closes, throwing keeps it open.
 *   • `targetLabel` is the noun the heading shows (e.g. "Daring
 *     Fireball" or "this source"). Keep it short.
 */

export interface RejectReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What's being rejected, for the heading copy. */
  targetLabel: string;
  /** Submit handler — receives the formatted reason string. Throw to
   *  keep the dialog open; resolve to close it. */
  onSubmit: (reason: string) => Promise<void> | void;
  /** Canned-reason options shown in the dropdown. Pass [] to skip
   *  the picker and force free-text only. */
  cannedReasons?: readonly string[];
  /** Override the title; defaults to "Reject {targetLabel}". */
  title?: string;
  /** Override the body description. */
  description?: string;
}

/** Sentinel for the "Other" canned option — when selected the
 *  dialog requires a non-empty note (it'd otherwise read as
 *  "selected the option that says 'use note below' and didn't
 *  use the note"). Imported from the same const so the gate stays
 *  in sync with the option list. */
const OTHER_REASON = "Other (use note below)";

const DEFAULT_REASONS: readonly string[] = [
  "Off-topic for our brand",
  "Low signal / poor quality",
  "Duplicate of an existing source",
  "Compliance / regulatory concern",
  OTHER_REASON,
];

/** Backend cap on rejectionReason — keep in sync with PatchBody.zod
 *  in peakhour-api/src/v1/routes/sources/trusted.ts. */
const REASON_MAX_LENGTH = 1024;

export function RejectReasonDialog(props: RejectReasonDialogProps) {
  // Mount the inner body only when open. Closed → unmounted → state
  // reset via remount on the next open. Avoids both the
  // setState-in-effect lint rule AND the "old reason from previous
  // row bleeds into next reject" bug, with no useEffect at all.
  // Radix Dialog still owns the controlled open state on the outer
  // shell so the parent's onOpenChange fires on outside-click / ESC.
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open ? <RejectReasonDialogBody {...props} /> : null}
    </Dialog>
  );
}

function RejectReasonDialogBody({
  onOpenChange,
  targetLabel,
  onSubmit,
  cannedReasons = DEFAULT_REASONS,
  title,
  description,
}: RejectReasonDialogProps) {
  const [selected, setSelected] = useState<string>("");
  const [detail, setDetail] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const hasOptions = cannedReasons.length > 0;
  const detailTrimmed = detail.trim();
  // Submit gating:
  //  • need a canned pick OR ≥3 chars of detail
  //  • when the canned pick is the OTHER sentinel, the detail is
  //    mandatory — submitting "Other (use note below)" alone reads
  //    as "I picked the option that says 'use the note' and didn't
  //    use the note." The backend would accept it; the UI shouldn't.
  const otherWithoutDetail =
    selected === OTHER_REASON && detailTrimmed.length < 3;
  const canSubmit =
    !submitting &&
    !otherWithoutDetail &&
    (Boolean(selected) || detailTrimmed.length >= 3);

  function combineReason(): string {
    const left = selected.trim();
    const right = detailTrimmed;
    const raw = left && right ? `${left}: ${right}` : left || right;
    // Backend caps at REASON_MAX_LENGTH; truncate so the dialog can
    // never round-trip to a VALIDATION_ERROR. Leaves a 1-char buffer
    // for the ellipsis so the truncation is visible to the operator
    // reading the audit trail later.
    if (raw.length <= REASON_MAX_LENGTH) return raw;
    return `${raw.slice(0, REASON_MAX_LENGTH - 1)}…`;
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    const reason = combineReason();
    if (!reason) return;
    setSubmitting(true);
    try {
      await onSubmit(reason);
      // Resolve = close. The caller's onSubmit invalidates queries
      // / fires toasts as it sees fit; the dialog only owns its
      // own open state.
      onOpenChange(false);
    } catch {
      // Caller threw — keep the dialog open so the user can retry
      // or amend. The caller is responsible for surfacing the
      // error toast; the dialog doesn't second-guess.
      setSubmitting(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title ?? `Reject ${targetLabel}`}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="space-y-4">
          {hasOptions && (
            <div className="grid gap-2">
              <Label htmlFor="reject-reason-canned">Reason</Label>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger id="reject-reason-canned">
                  <SelectValue placeholder="Pick a reason…" />
                </SelectTrigger>
                <SelectContent>
                  {cannedReasons.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="reject-reason-detail">
              {hasOptions ? "Note (optional)" : "Reason"}
            </Label>
            <Textarea
              id="reject-reason-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder={
                hasOptions
                  ? "Add detail to the canned reason — required when 'Other' is picked."
                  : "Why is this being rejected?"
              }
              maxLength={REASON_MAX_LENGTH}
              rows={3}
            />
            <p
              className={`text-xs tabular-nums ${otherWithoutDetail ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}
            >
              {otherWithoutDetail
                ? "Detail required when 'Other' is selected"
                : `${detail.length} / ${REASON_MAX_LENGTH}`}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
                Rejecting…
              </>
            ) : (
              "Reject"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
  );
}
