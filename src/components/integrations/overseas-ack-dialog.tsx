"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { overseasAckCopy, type OverseasAckCopy } from "@/lib/overseas-ack";

/**
 * The acknowledgement a merchant accepts before a connect starts. Wording
 * lives in `lib/overseas-ack.ts`, keyed by `version`. Radix Dialog supplies
 * the focus trap and Escape-to-close; Cancel and Escape do nothing else.
 */
export function OverseasAckDialog({
  version,
  open,
  onCancel,
  onConfirm,
}: {
  version: string;
  open: boolean;
  onCancel: () => void;
  onConfirm: (version: string) => void;
}) {
  const copy = overseasAckCopy(version);

  // No wording for this version: render nothing rather than a blank warning.
  if (!copy) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md">
        {/* DialogContent unmounts on close, so the tick state below resets:
            each connect attempt is its own acceptance. */}
        <AckBody
          copy={copy}
          version={version}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      </DialogContent>
    </Dialog>
  );
}

function AckBody({
  copy,
  version,
  onCancel,
  onConfirm,
}: {
  copy: OverseasAckCopy;
  version: string;
  onCancel: () => void;
  onConfirm: (version: string) => void;
}) {
  const [ticked, setTicked] = useState(false);
  const checkboxId = useId();
  return (
    <>
      <DialogHeader>
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription className="sr-only">
          {copy.body[0]}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 text-sm text-muted-foreground">
        {copy.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      <div className="flex items-start gap-2">
        <Checkbox
          id={checkboxId}
          checked={ticked}
          onCheckedChange={(v) => setTicked(v === true)}
          className="mt-0.5"
        />
        <Label
          htmlFor={checkboxId}
          className="text-sm font-normal leading-snug"
        >
          {copy.checkbox}
        </Label>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          {copy.cancel}
        </Button>
        <Button disabled={!ticked} onClick={() => onConfirm(version)}>
          {copy.confirm}
        </Button>
      </DialogFooter>
    </>
  );
}
