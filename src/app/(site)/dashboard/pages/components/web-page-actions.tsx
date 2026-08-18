"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/molecules/confirm-dialog";
import { RejectReasonDialog } from "@/components/molecules/reject-reason-dialog";
import { ApiError } from "@/lib/api";
import { useApproveWebPage, useRejectWebPage } from "@/hooks/use-web-pages";

/** Plain-language "send back" reasons — non-technical, for a business owner. */
const SEND_BACK_REASONS = [
  "Says something we don't actually offer",
  "Wrong tone for our brand",
  "Too thin / not specific to us",
  "Needs a different angle",
  "Other (use note below)",
] as const;

interface WebPageActionsProps {
  draftId: string;
  /** The page's name, for the confirm/send-back copy. */
  name: string;
  /** Called after a successful approve/reject (e.g. navigate away from a detail page). */
  onDone?: () => void;
  size?: "sm" | "default";
}

/**
 * Approve (→ publish live, behind a confirm) and Send back (→ won't publish, with
 * an optional reason). Shared by the queue row and the review page so both act on
 * a page identically.
 */
export function WebPageActions({ draftId, name, onDone, size = "sm" }: WebPageActionsProps) {
  const approve = useApproveWebPage();
  const reject = useRejectWebPage();
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const busy = approve.isPending || reject.isPending;

  async function doApprove() {
    try {
      const res = await approve.mutateAsync(draftId);
      toast.success(`Published — it's live at /${res.slug}`);
      onDone?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't publish this page. Please try again.");
    }
  }

  async function doSendBack(reason: string) {
    try {
      await reject.mutateAsync({ id: draftId, reason });
      toast.success("Sent back — this page won't be published.");
      onDone?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't send this page back. Please try again.");
      throw e; // keep the reason dialog open
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size={size} disabled={busy} onClick={() => setSendBackOpen(true)}>
        Send back
      </Button>
      <ConfirmDialog
        trigger={
          <Button size={size} disabled={busy}>
            Approve &amp; publish
          </Button>
        }
        title={`Publish “${name}”?`}
        description="This puts the page live on your website right away. If anything looks wrong, send it back instead."
        confirmLabel="Approve & publish"
        onConfirm={doApprove}
      />
      <RejectReasonDialog
        open={sendBackOpen}
        onOpenChange={setSendBackOpen}
        targetLabel={name}
        title={`Send “${name}” back`}
        description="This page won't be published. Tell us what's wrong (optional) so it can be improved."
        cannedReasons={SEND_BACK_REASONS}
        onSubmit={doSendBack}
      />
    </div>
  );
}
