"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquarePlus, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useFeedbackContext } from "@/hooks/use-feedback-context";
import { useCreateTicket } from "@/hooks/use-feedback";

const CATEGORIES = [
  { value: "bug", label: "Bug Report" },
  { value: "feature", label: "Feature Request" },
  { value: "improvement", label: "Improvement" },
  { value: "question", label: "Question" },
] as const;

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const feedbackContext = useFeedbackContext();
  const createTicket = useCreateTicket();

  function resetForm() {
    setCategory("");
    setDescription("");
    setSubmitted(false);
    createTicket.reset();
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      // Reset after sheet close animation
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
        <Button variant="ghost" size="icon" className="size-8">
          <MessageSquarePlus className="size-4" />
          <span className="sr-only">Send Feedback</span>
        </Button>
      </SheetTrigger>

      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Send Feedback</SheetTitle>
          <SheetDescription>
            Help us improve PeakHour. Report a bug, request a feature, or share
            your ideas.
          </SheetDescription>
        </SheetHeader>

        {submitted ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <CheckCircle2 className="size-12 text-green-500" />
            <div className="space-y-2">
              <p className="text-lg font-medium">Thanks for your feedback!</p>
              <p className="text-sm text-muted-foreground">
                We&apos;ve received your ticket and will look into it.
              </p>
            </div>
            <Link
              href="/dashboard/settings/tickets"
              className="text-sm text-primary underline-offset-4 hover:underline"
              onClick={() => setOpen(false)}
            >
              Track your tickets
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {/* Auto-captured context chips */}
            <div className="flex flex-wrap gap-1.5">
              {feedbackContext.module !== "other" && (
                <Badge variant="secondary" className="text-xs">
                  {feedbackContext.module}
                </Badge>
              )}
              {feedbackContext.entityType && (
                <Badge variant="outline" className="text-xs">
                  {feedbackContext.entityType}
                </Badge>
              )}
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="What kind of feedback?" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell us what happened or what you'd like to see..."
                rows={5}
                maxLength={8192}
                required
              />
              <p className="text-xs text-muted-foreground">
                {description.length}/8192
              </p>
            </div>

            {/* Error */}
            {createTicket.isError && (
              <p className="text-sm text-destructive">
                Something went wrong. Please try again.
              </p>
            )}

            {/* Submit */}
            <Button
              type="submit"
              className="w-full"
              disabled={!category || !description.trim() || createTicket.isPending}
            >
              {createTicket.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Feedback"
              )}
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
