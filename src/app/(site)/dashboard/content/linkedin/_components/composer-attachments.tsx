"use client";

import { AtSign, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LinkedInVisibility } from "@/lib/api/linkedin-content";
import type { ResolvedMention } from "./commentary-segments";

/** The "Mentions" chip row under the composer textarea. */
export function MentionsStrip({
  mentions,
  onUnlink,
}: {
  mentions: ResolvedMention[];
  onUnlink: (urn: string) => void;
}) {
  if (mentions.length === 0) return null;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-micro uppercase tracking-wide text-muted-foreground">Mentions</span>
        {mentions.map((m) => (
          <span
            key={m.urn}
            className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs"
          >
            <AtSign className="size-3 text-muted-foreground" />
            {m.name}
            <button
              type="button"
              onClick={() => onUnlink(m.urn)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Unlink mention ${m.name}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
      <p className="text-micro text-muted-foreground">
        Mentions link when you publish now. Scheduled posts send them as plain text.
      </p>
    </div>
  );
}

/** The "Attach link" card (URL + optional title + Remove). */
export function LinkAttachCard({
  linkUrl,
  linkTitle,
  linkInvalid,
  onLinkUrlChange,
  onLinkTitleChange,
  onRemove,
}: {
  linkUrl: string;
  linkTitle: string;
  linkInvalid: boolean;
  onLinkUrlChange: (value: string) => void;
  onLinkTitleChange: (value: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      <Label htmlFor="li-link-url" className="text-xs uppercase tracking-wide text-muted-foreground">
        Attach link
      </Label>
      <Input
        id="li-link-url"
        value={linkUrl}
        onChange={(e) => onLinkUrlChange(e.target.value)}
        placeholder="https://example.com/article"
        aria-invalid={linkInvalid}
      />
      <Input
        value={linkTitle}
        onChange={(e) => onLinkTitleChange(e.target.value)}
        placeholder="Link title (optional)"
      />
      <div className="flex items-center justify-between">
        {linkInvalid ? (
          <p className="text-xs text-destructive">Enter a valid http(s) URL.</p>
        ) : (
          <span />
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <X className="size-3.5 mr-1" /> Remove
        </Button>
      </div>
    </div>
  );
}

/** Post visibility picker; company-page posts are always public. */
export function VisibilitySelect({
  value,
  onChange,
  isOrgAuthor,
}: {
  value: LinkedInVisibility;
  onChange: (value: LinkedInVisibility) => void;
  isOrgAuthor: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="li-visibility" className="text-xs uppercase tracking-wide text-muted-foreground">
        Visibility
      </Label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as LinkedInVisibility)}
        disabled={isOrgAuthor}
      >
        <SelectTrigger id="li-visibility">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="PUBLIC">Public — anyone on LinkedIn</SelectItem>
          <SelectItem value="CONNECTIONS">Connections only</SelectItem>
          <SelectItem value="LOGGED_IN">Signed-in members</SelectItem>
        </SelectContent>
      </Select>
      {isOrgAuthor && (
        <p className="text-xs text-muted-foreground">
          Company page posts are always public.
        </p>
      )}
    </div>
  );
}
