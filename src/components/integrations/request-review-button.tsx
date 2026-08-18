"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { MessageSquareWarning } from "lucide-react";

/**
 * "We got this wrong — request a review" action for the integration-fit guard.
 * Files a support ticket (POST /v1/integrations/review-requests → sup_inbox) when
 * a user disputes a connect block or a wrong-brand flag. Shared by the connect-
 * time mismatch banner and the settings "Needs attention" card.
 */

interface ReviewCandidate {
  identity?: { kind: "domain" | "handle"; value: string };
  displayName?: string;
}

interface RequestReviewButtonProps {
  provider: string;
  anchor?: string | null;
  candidate?: ReviewCandidate;
  className?: string;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "link";
  label?: string;
}

export function RequestReviewButton({
  provider,
  anchor,
  candidate,
  className,
  size = "sm",
  variant = "ghost",
  label = "We got this wrong — request a review",
}: RequestReviewButtonProps) {
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    setSending(true);
    try {
      await api.post("/v1/integrations/review-requests", {
        provider,
        ...(anchor ? { anchor } : {}),
        ...(candidate ? { candidate } : {}),
      });
      setDone(true);
      toast.success("Thanks — our team will review this and get back to you.");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Couldn't send your request. Please try again.",
      );
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <span role="status" className="text-xs text-muted-foreground">
        Review requested ✓
      </span>
    );
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      disabled={sending}
      onClick={submit}
    >
      <MessageSquareWarning className="h-3.5 w-3.5" />
      {sending ? "Sending…" : label}
    </Button>
  );
}
