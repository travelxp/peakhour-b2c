"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { QueryError } from "@/components/dashboard/query-error";
import { useIsMobile } from "@/hooks/use-mobile";
import { useApprovalLinks, useCreateApprovalLink, useRevokeApprovalLink } from "@/hooks/use-studio-pro";
import type { ApprovalLink, CreatedApprovalLink } from "@/lib/api/creative-studio";
import { liveLinkFor } from "@/lib/studio-pro";
import { approvalLinkUrl } from "@/lib/studio";
import { studioRefusal } from "@/lib/studio-flow";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { cn } from "@/lib/utils";

const A = STUDIO_COPY.approvalSend;

const dayLabel = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? "" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(t));
};

export interface SendablePreview {
  id: string;
  number: number;
  headline: string | null;
}

export interface ApprovalSendViewProps {
  previews: SendablePreview[];
  links: ApprovalLink[];
  /** The link just made: its address is shown once, here, and never again. */
  /** Addresses just made, by preview. Each is shown once, so making a second link must not take the first one away. */
  fresh: Readonly<Record<string, string>>;
  canMake: boolean;
  pendingPreview: string | null;
  revokingId: string | null;
  error?: string;
  onCreate: (previewId: string) => void;
  onCopy: (url: string) => void;
  onRevoke: (linkId: string) => void;
}

/**
 * Sender side of approval by link (UX spec S18): pick a preview, make a link, copy it, stop it later. The link's address is shown once, right after it is made (only its hash
 * is kept), with the plain promise of what it allows: one picture, no account, seven days.
 */
export function ApprovalSendView({ previews, links, fresh, canMake, pendingPreview, revokingId, error, onCreate, onCopy, onRevoke }: ApprovalSendViewProps) {
  if (previews.length === 0) return <p className="text-sm text-muted-foreground">{A.nothingToSend}</p>;
  return (
    <div className="space-y-5" data-slot="studio-approval-send">
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm">
          {error}
        </p>
      )}
      <section aria-labelledby="studio-send-pick" className="space-y-2">
        <h3 id="studio-send-pick" className="text-sm font-semibold">
          {A.pick}
        </h3>
        <ul className="space-y-2">
          {previews.map((p) => {
            const live = liveLinkFor(links, p.id);
            const freshUrl = fresh[p.id];
            const name = A.previewName(p.number, p.headline ?? "");
            return (
              <li key={p.id} className="space-y-2 rounded-lg border p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm">{name}</span>
                  <Button type="button" variant="outline" className="h-11" disabled={!canMake || pendingPreview !== null} aria-label={`${A.create}: ${name}`} onClick={() => onCreate(p.id)}>
                    {A.create}
                  </Button>
                </div>
                {live && !freshUrl && <p className="text-xs text-muted-foreground">{A.expires(dayLabel(live.expiresAt))}</p>}
                {freshUrl && (
                  <div className="space-y-2">
                    <p role="status" className="text-xs text-muted-foreground">
                      {A.shownOnce}
                    </p>
                    <div className="flex gap-2">
                      <Input readOnly value={freshUrl} aria-label={A.copy} className="h-11" onFocus={(e) => e.currentTarget.select()} />
                      <Button type="button" className="h-11" onClick={() => onCopy(freshUrl)}>
                        {A.copy}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {!canMake && <p className="text-xs text-muted-foreground">{A.viewer}</p>}
      </section>

      <section aria-labelledby="studio-send-links" className="space-y-2">
        <h3 id="studio-send-links" className="text-sm font-semibold">
          {A.linksTitle}
        </h3>
        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground">{A.noLinks}</p>
        ) : (
          <ul className="space-y-2">
            {links.map((l) => {
              const preview = previews.find((p) => p.id === l.previewId);
              return (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">{preview ? A.previewName(preview.number, "") : A.earlierPreview}</p>
                    <p className={cn("text-xs", l.state === "waiting" ? "text-foreground" : "text-muted-foreground")}>
                      {A.states[l.state]}
                      {l.answeredName ? ` ${A.answeredBy(l.answeredName)}` : ""}
                      {l.state === "waiting" ? `. ${A.expires(dayLabel(l.expiresAt))}` : ""}
                    </p>
                  </div>
                  {l.state === "waiting" && (
                    <Button type="button" variant="ghost" className="h-11" disabled={!canMake || revokingId !== null} onClick={() => onRevoke(l.id)}>
                      {A.revoke}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Copy to the clipboard where the browser allows it; false (and the person copies by hand) where it does not. */
async function copyText(text: string): Promise<boolean> {
  const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
  if (!clipboard?.writeText) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** The "Send for approval" sheet on the creative page (Pro tools). */
export function ApprovalSendSheet({
  creativeId,
  open,
  onOpenChange,
  previews,
  canMake,
}: {
  creativeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previews: SendablePreview[];
  canMake: boolean;
}) {
  const mobile = useIsMobile();
  const links = useApprovalLinks(creativeId, open);
  const create = useCreateApprovalLink(creativeId);
  const revoke = useRevokeApprovalLink(creativeId);
  const [fresh, setFresh] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | undefined>();

  const onCreate = (previewId: string) => {
    setError(undefined);
    create.mutate(previewId, {
      onSuccess: (r: CreatedApprovalLink) => setFresh((f) => ({ ...f, [previewId]: approvalLinkUrl(window.location.origin, r.token) })),
      onError: (e) => setError(studioRefusal(e).text),
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        // The address was shown once: closing the sheet forgets it.
        if (!o) {
          setFresh({});
          setError(undefined);
        }
        onOpenChange(o);
      }}
    >
      <SheetContent side={mobile ? "bottom" : "right"} className={cn("gap-3 overflow-y-auto p-4", mobile ? "max-h-[92dvh]" : "sm:max-w-lg")}>
        <SheetHeader className="p-0">
          <SheetTitle>{A.title}</SheetTitle>
          <SheetDescription>{A.description}</SheetDescription>
        </SheetHeader>
        {links.isPending && links.errorUpdatedAt === 0 ? (
          <Skeleton aria-busy="true" aria-label={A.title} className="h-40 rounded-lg" />
        ) : links.data ? (
          <ApprovalSendView
            previews={previews}
            links={links.data}
            fresh={fresh}
            canMake={canMake}
            pendingPreview={create.isPending ? (create.variables ?? "") : null}
            revokingId={revoke.isPending ? (revoke.variables ?? "") : null}
            {...(error ? { error } : {})}
            onCreate={onCreate}
            onCopy={(url) => void copyText(url).then((ok) => (ok ? toast.success(A.copied) : toast.error(A.copyFailed)))}
            onRevoke={(id) => {
              setError(undefined);
              revoke.mutate(id, { onSuccess: () => toast(A.revoked), onError: (e) => setError(studioRefusal(e).text) });
            }}
          />
        ) : (
          <QueryError what={A.error} onRetry={() => void links.refetch()} />
        )}
      </SheetContent>
    </Sheet>
  );
}
