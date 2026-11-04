"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createShareLink, listShareLinks, revokeShareLink, type ShareLinkRow } from "@/lib/api/media";
import { SharePrivacyNote, ShareAccessPanel } from "./share-privacy";
import { NOT_OPENED_YET, openedAtText } from "@/lib/drive-share-copy";

/**
 * Share links for one PRIVATE file, in the file panel: make a link (expiry and optional password, with the line that says what opening
 * it records), see the links already made, revoke one, and open a link's "Opened by" list. Editors and above (the api refuses a viewer).
 */

export const EXPIRY_CHOICES = [
  { days: 1, label: "1 day" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

export interface ShareLinksViewProps {
  links: ShareLinkRow[] | undefined;
  loading?: boolean;
  error?: boolean;
  now: Date;
  creating: boolean;
  expiryDays: number;
  password: string;
  onExpiry: (d: number) => void;
  onPassword: (p: string) => void;
  onCreate: () => void;
  onRevoke: (id: string) => void;
  /** The address of the link just made: shown once, in a field that stays until it is dismissed (addresses are never listed again). */
  createdUrl?: string | null;
  revoking?: boolean;
}

function state(l: ShareLinkRow, now: Date): "revoked" | "expired" | "live" {
  if (l.revokedAt) return "revoked";
  return new Date(l.expiresAt).getTime() <= now.getTime() ? "expired" : "live";
}

export function ShareLinksView(p: ShareLinksViewProps) {
  return (
    <section aria-label="Share links" className="grid gap-3">
      <h3 className="text-sm font-medium">Share links</h3>
      <div className="grid gap-2">
        <label className="grid gap-1 text-xs">
          Expires after
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={p.expiryDays} onChange={(e) => p.onExpiry(Number(e.target.value))}>
            {EXPIRY_CHOICES.map((c) => (
              <option key={c.days} value={c.days}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs">
          Password (optional, at least 8 characters)
          <Input type="password" autoComplete="new-password" value={p.password} onChange={(e) => p.onPassword(e.target.value)} />
        </label>
        <SharePrivacyNote />
        {p.createdUrl ? (
          <Input readOnly aria-label="The new link" value={p.createdUrl} onFocus={(e) => e.currentTarget.select()} />
        ) : null}
        <Button type="button" variant="outline" disabled={p.creating || (p.password.length > 0 && p.password.length < 8)} onClick={p.onCreate}>
          {p.creating ? "Making the link." : "Make link and copy"}
        </Button>
      </div>
      {p.loading ? (
        <p className="text-sm text-muted-foreground" aria-busy="true">Loading.</p>
      ) : p.error || !p.links ? (
        <p className="text-sm text-muted-foreground" role="alert">We could not load the links. Please try again.</p>
      ) : p.links.length === 0 ? (
        <p className="text-sm text-muted-foreground">No links yet.</p>
      ) : (
        <ul className="grid gap-2">
          {p.links.map((l) => {
            const s = state(l, p.now);
            return (
              <li key={l.id} className="grid gap-1 rounded-lg border p-2" data-testid="share-link-row">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    {s === "live" ? `Expires ${openedAtText(l.expiresAt)}` : s === "revoked" ? "Revoked" : "Expired"}
                    {l.hasPassword ? ", password" : ""}
                    {`, opened ${l.openCount} ${l.openCount === 1 ? "time" : "times"}`}
                  </span>
                  {s === "live" ? (
                    <Button type="button" size="sm" variant="ghost" disabled={p.revoking} onClick={() => p.onRevoke(l.id)}>
                      Revoke
                    </Button>
                  ) : null}
                </div>
                {/* The history holds visitors' addresses: read it only for a link that has been opened. */}
                {l.openCount > 0 ? (
                  <details>
                    <summary className="cursor-pointer text-xs text-muted-foreground">Opened by</summary>
                    <ShareAccessPanel shareId={l.id} />
                  </details>
                ) : (
                  <p className="text-xs text-muted-foreground">{NOT_OPENED_YET}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function ShareLinksPanel({ mediaId }: { mediaId: string }) {
  const qc = useQueryClient();
  const [expiryDays, setExpiryDays] = useState(7);
  const [password, setPassword] = useState("");
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["drive-share-links", mediaId], queryFn: () => listShareLinks(mediaId), retry: 1 });
  const create = useMutation({
    mutationFn: () => createShareLink(mediaId, { expiresInDays: expiryDays, ...(password ? { password } : {}) }),
    onSuccess: async (r) => {
      setPassword("");
      setCreatedUrl(r.url);
      void qc.invalidateQueries({ queryKey: ["drive-share-links", mediaId] });
      try {
        await navigator.clipboard.writeText(r.url);
        toast.success("Link copied.");
      } catch {
        toast.message("Link made. Copy it from the field below.");
      }
    },
    onError: () => toast.error("A link could not be made. Try again in a moment."),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => revokeShareLink(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["drive-share-links", mediaId] }),
    onError: () => toast.error("That link could not be revoked. Try again in a moment."),
  });
  return (
    <ShareLinksView
      links={q.data}
      loading={q.isPending}
      error={q.isError}
      now={new Date()}
      creating={create.isPending}
      expiryDays={expiryDays}
      password={password}
      onExpiry={setExpiryDays}
      onPassword={setPassword}
      onCreate={() => create.mutate()}
      onRevoke={(id) => revoke.mutate(id)}
      createdUrl={createdUrl}
      revoking={revoke.isPending}
    />
  );
}
