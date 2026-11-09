"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RESUME_DRAFT_BODY, RESUME_DRAFT_CONFIRM, RESUME_DRAFT_KEEP, RESUME_DRAFT_TITLE } from "@/lib/wa-inbox-reply";

/**
 * SA-12: asked before "Resume the assistant" / "Hand back" when a reply is written and not sent. One dialog for WhatsApp, Messenger,
 * Instagram and website chats, so the same press warns the same way wherever the person is working.
 */
export function ResumeDraftDialog({ open, onKeep, onConfirm }: { open: boolean; onKeep: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? undefined : onKeep())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{RESUME_DRAFT_TITLE}</DialogTitle>
          <DialogDescription>{RESUME_DRAFT_BODY}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onKeep}>
            {RESUME_DRAFT_KEEP}
          </Button>
          <Button onClick={onConfirm}>{RESUME_DRAFT_CONFIRM}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
