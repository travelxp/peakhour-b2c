"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListChecks, Plus, X } from "lucide-react";
import type { LinkedInPollDuration } from "@/lib/api/linkedin-content";

// Mirror the LinkedIn Poll API limits (confirmed vs live 202605 poll-post-api).
export const POLL_QUESTION_MAX = 140;
export const POLL_OPTION_MAX = 30;
export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 4;

/** An editor option. The `id` is a stable React key so removing an option
 *  mid-edit doesn't smear focus/caret across the remaining inputs (index keys
 *  would). It never leaves the editor — submit sends only the text. */
export interface PollOption {
  id: string;
  text: string;
}

export interface PollState {
  question: string;
  /** Always holds 2–4 entries in the editor; blanks are dropped on submit. */
  options: PollOption[];
  duration: LinkedInPollDuration;
}

function newOption(): PollOption {
  return { id: crypto.randomUUID(), text: "" };
}

/** A fresh poll with two empty options and a sensible default duration. */
export function emptyPoll(): PollState {
  return { question: "", options: [newOption(), newOption()], duration: "SEVEN_DAYS" };
}

/** Normalize an option for comparison/dedup (trim + case-fold). */
function normalizeOption(text: string): string {
  return text.trim().toLowerCase();
}

/**
 * Whether the poll is publishable: a non-empty question within length, and
 * 2–4 non-blank, DISTINCT options each within length. Mirrors the server's
 * `buildPollContent` rules (LinkedIn also rejects duplicate option text), so
 * the publish button state matches what the API will accept.
 */
export function isPollValid(poll: PollState): boolean {
  const question = poll.question.trim();
  if (question.length === 0 || question.length > POLL_QUESTION_MAX) return false;
  const texts = poll.options.map((o) => o.text.trim()).filter((o) => o.length > 0);
  if (texts.length < POLL_MIN_OPTIONS || texts.length > POLL_MAX_OPTIONS) return false;
  if (texts.some((o) => o.length > POLL_OPTION_MAX)) return false;
  const distinct = new Set(texts.map((o) => o.toLowerCase()));
  return distinct.size === texts.length;
}

const DURATION_LABELS: Record<LinkedInPollDuration, string> = {
  ONE_DAY: "1 day",
  THREE_DAYS: "3 days",
  SEVEN_DAYS: "1 week",
  FOURTEEN_DAYS: "2 weeks",
};
const DURATION_ORDER: LinkedInPollDuration[] = [
  "ONE_DAY",
  "THREE_DAYS",
  "SEVEN_DAYS",
  "FOURTEEN_DAYS",
];

/**
 * Poll editor block (CMA D5). Controlled — the composer owns the `PollState`
 * so it can validate + submit it. A poll is an exclusive content block, so the
 * composer hides the link/carousel affordances while this is mounted.
 */
export function PollEditor({
  value,
  onChange,
  onRemove,
}: {
  value: PollState;
  onChange: (next: PollState) => void;
  onRemove: () => void;
}) {
  const setOption = (id: string, text: string) => {
    onChange({
      ...value,
      options: value.options.map((o) => (o.id === id ? { ...o, text } : o)),
    });
  };
  const addOption = () => {
    if (value.options.length >= POLL_MAX_OPTIONS) return;
    onChange({ ...value, options: [...value.options, newOption()] });
  };
  const removeOption = (id: string) => {
    if (value.options.length <= POLL_MIN_OPTIONS) return;
    onChange({ ...value, options: value.options.filter((o) => o.id !== id) });
  };

  // Flag any option whose (trimmed, case-folded) text duplicates another so we
  // can show an inline hint instead of letting LinkedIn reject the post.
  const seen = new Map<string, number>();
  for (const o of value.options) {
    const key = normalizeOption(o.text);
    if (key) seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const hasDuplicates = [...seen.values()].some((n) => n > 1);

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
          <ListChecks className="size-3.5" /> Poll
        </Label>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <X className="size-3.5 mr-1" /> Remove poll
        </Button>
      </div>

      <div className="space-y-1.5">
        <Input
          value={value.question}
          onChange={(e) => onChange({ ...value, question: e.target.value })}
          placeholder="Ask a question…"
          maxLength={POLL_QUESTION_MAX}
          aria-label="Poll question"
        />
        <p className="text-right text-[11px] text-muted-foreground tabular-nums">
          {value.question.trim().length}/{POLL_QUESTION_MAX}
        </p>
      </div>

      <div className="space-y-2">
        {value.options.map((opt, i) => {
          const isDup = opt.text.trim().length > 0 && (seen.get(normalizeOption(opt.text)) ?? 0) > 1;
          return (
            <div key={opt.id} className="flex items-center gap-2">
              <Input
                value={opt.text}
                onChange={(e) => setOption(opt.id, e.target.value)}
                placeholder={`Option ${i + 1}`}
                maxLength={POLL_OPTION_MAX}
                aria-label={`Poll option ${i + 1}`}
                aria-invalid={isDup}
              />
              {value.options.length > POLL_MIN_OPTIONS && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={() => removeOption(opt.id)}
                  aria-label={`Remove option ${i + 1}`}
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
          );
        })}
        {hasDuplicates && (
          <p className="text-xs text-destructive">Poll options must be unique.</p>
        )}
        {value.options.length < POLL_MAX_OPTIONS && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addOption}
            className="h-7 gap-1.5 px-2 text-xs"
          >
            <Plus className="size-3.5" /> Add option
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="poll-duration" className="text-xs uppercase tracking-wide text-muted-foreground">
          Poll duration
        </Label>
        <Select
          value={value.duration}
          onValueChange={(d) => onChange({ ...value, duration: d as LinkedInPollDuration })}
        >
          <SelectTrigger id="poll-duration">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DURATION_ORDER.map((d) => (
              <SelectItem key={d} value={d}>
                {DURATION_LABELS[d]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
