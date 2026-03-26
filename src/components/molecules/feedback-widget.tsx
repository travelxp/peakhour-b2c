"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquarePlus, CheckCircle2, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useFeedbackContext } from "@/hooks/use-feedback-context";
import { useCreateTicket, useMyTickets } from "@/hooks/use-feedback";

const CATEGORIES = [
  { value: "bug", label: "Bug Report", emoji: "🐛" },
  { value: "feature", label: "Feature Request", emoji: "💡" },
  { value: "improvement", label: "Improvement", emoji: "✨" },
  { value: "question", label: "Question", emoji: "❓" },
] as const;

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const feedbackContext = useFeedbackContext();
  const createTicket = useCreateTicket();
  const { data: tickets } = useMyTickets();
  const openCount = tickets?.filter(
    (t) => t.status !== "resolved" && t.status !== "closed"
  ).length;

  function resetForm() {
    setCategory("");
    setDescription("");
    setSubmitted(false);
    createTicket.reset();
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setTimeout(resetForm, 300);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category || !description.trim()) return;

    try {
      await createTicket.mutateAsync({
        category,
        description: description.trim(),
        context: { ...feedbackContext },
      });
      setSubmitted(true);
    } catch {
      // Error is available via createTicket.error
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-8">
          <MessageSquarePlus className="size-4" />
          {!!openCount && openCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-medium text-primary-foreground">
              {openCount > 9 ? "9+" : openCount}
            </span>
          )}
          <span className="sr-only">Send Feedback</span>
        </Button>
      </SheetTrigger>

      <SheetContent className="flex flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Send Feedback</SheetTitle>
          <SheetDescription>
            Help us improve PeakHour. Report a bug, request a feature, or share
            your ideas.
          </SheetDescription>
        </SheetHeader>

        {submitted ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle2 className="size-8 text-green-500" />
            </div>
            <div className="space-y-1.5">
              <p className="text-lg font-semibold">Thanks for your feedback!</p>
              <p className="text-sm text-muted-foreground">
                We&apos;ve created a ticket and will look into it.
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <Link href="/dashboard/settings/tickets" onClick={() => setOpen(false)}>
                <ExternalLink className="size-3.5" />
                View my tickets
              </Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 overflow-y-auto px-4">
            {/* Auto-captured context */}
            {(feedbackContext.module !== "other" || feedbackContext.entityType) && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Context:</span>
                {feedbackContext.module !== "other" && (
                  <Badge variant="secondary" className="text-xs capitalize">
                    {feedbackContext.module}
                  </Badge>
                )}
                {feedbackContext.entityType && (
                  <Badge variant="outline" className="text-xs">
                    {feedbackContext.entityType}
                  </Badge>
                )}
              </div>
            )}

            {/* Category */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="What kind of feedback?" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <span className="flex items-center gap-2">
                        <span>{cat.emoji}</span>
                        <span>{cat.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell us what happened or what you'd like to see..."
                rows={5}
                maxLength={8192}
                required
                className="resize-none"
              />
              <p className="text-[11px] text-muted-foreground text-right tabular-nums">
                {description.length.toLocaleString()}/8,192
              </p>
            </div>

            {/* Error */}
            {createTicket.isError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Something went wrong. Please try again.
              </div>
            )}
          </form>
        )}

        {!submitted && (
          <SheetFooter className="border-t px-4">
            <div className="flex w-full items-center gap-3">
              {!!openCount && openCount > 0 && (
                <Link
                  href="/dashboard/settings/tickets"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setOpen(false)}
                >
                  {openCount} open ticket{openCount !== 1 ? "s" : ""}
                </Link>
              )}
              <Button
                type="submit"
                className="ml-auto"
                disabled={!category || !description.trim() || createTicket.isPending}
                onClick={handleSubmit}
              >
                {createTicket.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
