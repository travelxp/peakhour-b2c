"use client";

import Link from "next/link";
import { Building2, User } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LinkedInIdentity, LinkedInVisibility } from "@/lib/api/linkedin-content";
import { HAS_ORG_SCOPE, type AuthorOption } from "@/lib/linkedin-composer";
import { VisibilitySelect } from "./composer-attachments";

/** The composer's header: who the post is from, and who can see it. */
export function ComposerHeader({
  identity,
  authorOptions,
  authorKey,
  onAuthorChange,
  effectiveVisibility,
  onVisibilityChange,
  isOrgAuthor,
}: {
  identity: LinkedInIdentity;
  authorOptions: AuthorOption[];
  authorKey: string;
  onAuthorChange: (key: string) => void;
  effectiveVisibility: LinkedInVisibility;
  onVisibilityChange: (v: LinkedInVisibility) => void;
  isOrgAuthor: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="li-author" className="text-xs uppercase tracking-wide text-muted-foreground">
          Posting as
        </Label>
        {authorOptions.length === 1 ? (
          // Single allowed author (the mapped Company Page, or the
          // pageless personal fallback) — nothing to choose, so show
          // a locked identity chip instead of a one-item dropdown.
          <div
            id="li-author"
            className="flex h-9 items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm"
          >
            {authorOptions[0].value === "person" ? (
              <User className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <Building2 className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate font-medium">{authorOptions[0].label}</span>
            {authorOptions[0].sublabel && (
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {authorOptions[0].sublabel}
              </span>
            )}
          </div>
        ) : (
          <Select value={authorKey} onValueChange={onAuthorChange}>
            <SelectTrigger id="li-author">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {authorOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className="flex flex-col">
                    <span>{opt.label}</span>
                    {opt.sublabel && (
                      <span className="text-xs text-muted-foreground">{opt.sublabel}</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!identity.scopes.includes(HAS_ORG_SCOPE) && identity.pages.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Reconnect LinkedIn to enable posting from your company pages.
          </p>
        )}
        {identity.scopes.includes(HAS_ORG_SCOPE) && identity.pages.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No pages enabled.{" "}
            <Link
              href="/dashboard/integrations?manage_pages=1"
              className="font-medium text-primary underline underline-offset-2 hover:no-underline"
            >
              Manage pages
            </Link>
            .
          </p>
        )}
      </div>

      <VisibilitySelect
        value={effectiveVisibility}
        onChange={onVisibilityChange}
        isOrgAuthor={isOrgAuthor}
      />
    </div>
  );
}
