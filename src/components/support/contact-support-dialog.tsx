"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LifeBuoy } from "lucide-react";

/**
 * "Contact support" — a general in-app support entry point. Files into the same
 * unified support inbox (POST /v1/support/contact → sup_inbox, source:"in_app")
 * that the integration-fit disputes use, so the CMS triages everything in one
 * queue.
 */

const CATEGORIES: Array<{ value: string; label: string }> = [
  { value: "technical", label: "Something's not working" },
  { value: "billing", label: "Billing & plans" },
  { value: "integrations", label: "Integrations" },
  { value: "account", label: "My account" },
  { value: "content", label: "Content & AI" },
  { value: "feedback", label: "Feedback / idea" },
  { value: "other", label: "Something else" },
];

export function ContactSupportDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("technical");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function submit() {
    if (!body.trim()) {
      toast.error("Please describe what you need help with.");
      return;
    }
    setSending(true);
    try {
      await api.post("/v1/support/contact", {
        category,
        subject: subject.trim() || undefined,
        body: body.trim(),
      });
      toast.success("Thanks — our team will get back to you.");
      setOpen(false);
      setSubject("");
      setBody("");
      setCategory("technical");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't send your message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-1.5">
            <LifeBuoy className="h-3.5 w-3.5" />
            Contact support
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contact support</DialogTitle>
          <DialogDescription>
            Tell us what you need — we&apos;ll pick it up and reply.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="support-category">Topic</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="support-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="support-subject">Subject (optional)</Label>
            <Input
              id="support-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={256}
              placeholder="A one-line summary"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="support-body">How can we help?</Label>
            <Textarea
              id="support-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={5000}
              rows={5}
              placeholder="Describe what you need…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={sending}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
