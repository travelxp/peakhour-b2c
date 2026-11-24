"use client";

/**
 * <FirstCommentField/>: the optional comment a post carries, put on it by Peakhour right after it is live (W3-E1).
 *
 * WHETHER A CHANNEL TAKES ONE, AND HOW LONG, IS THE API'S ANSWER. `GET /v1/media/rules` carries `firstComment: { maxLength }` on a post row when the channel's
 * API allows it, so this component holds no channel list: it renders nothing for a channel with no such row, and a channel that gains the feature shows the box
 * with no change here.
 */
import { useId } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMediaRules } from "@/lib/media-rules";
import { firstCommentRuleOf } from "@/lib/first-comment";

export interface FirstCommentFieldProps {
  channel: string;
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
}

export function FirstCommentField({ channel, value, onChange, readOnly }: FirstCommentFieldProps) {
  const id = useId();
  const rules = useMediaRules();
  const rule = firstCommentRuleOf(rules.data, channel);
  if (!rule) return null;
  // counted as it is sent: trimmed, by character (an emoji is one)
  const length = [...value.trim()].length;
  const over = length > rule.maxLength;
  return (
    <div className="space-y-1" data-testid="first-comment-field">
      <Label htmlFor={id} className="text-xs uppercase tracking-wide text-muted-foreground">
        First comment (optional)
      </Label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        rows={2}
        placeholder="Added as the first comment as soon as the post is live"
        aria-invalid={over || undefined}
        className="resize-none"
      />
      <p className={over ? "text-micro text-destructive" : "text-micro text-muted-foreground"} role={over ? "alert" : undefined}>
        {over ? `${length - rule.maxLength} over the ${rule.maxLength.toLocaleString()} characters this channel takes` : `${length.toLocaleString()} of ${rule.maxLength.toLocaleString()}`}
      </p>
    </div>
  );
}
