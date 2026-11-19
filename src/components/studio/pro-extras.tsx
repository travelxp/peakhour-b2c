"use client";

import { useState } from "react";
import { History, Send, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApprovalSendSheet, type SendablePreview } from "@/components/studio/approval-send";
import type { PreviewView } from "@/lib/api/creative-studio";
import { STUDIO_COPY } from "@/lib/studio-copy";

const X = STUDIO_COPY.proExtras;

/** A piece that is not built yet: a tile that says so, never a button that does nothing. Nothing here asks for a price. */
function SoonTile({ title, description }: { title: string; description: string }) {
  return (
    <li data-slot="studio-pro-soon" className="flex items-start gap-3 rounded-lg border border-dashed p-3">
      <Sparkles aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {title}
          <Badge variant="secondary">{X.soon}</Badge>
        </p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </li>
  );
}

/**
 * The Pro pieces on the creative page (UX spec section 3, S17, S18): the history, "Send for approval", and the two that are not built yet (Canva, "Test two versions"),
 * which show as "Coming soon" tiles. Mounted only with Pro tools on.
 */
export function ProExtras({ creativeId, previews, canMake, onHistory }: { creativeId: string; previews: PreviewView[]; canMake: boolean; onHistory: () => void }) {
  const [sendOpen, setSendOpen] = useState(false);
  // Numbered among all the previews shown, the same list the history and the picture descriptions number, so "Preview 2" is the same picture everywhere.
  const sendable: SendablePreview[] = previews.flatMap((p, i) => (p.state === "ready" || p.state === "shortlisted" ? [{ id: p.id, number: i + 1, headline: p.headline }] : []));
  return (
    <section aria-labelledby="studio-pro-extras" className="space-y-3 rounded-lg border bg-card p-4" data-slot="studio-pro-extras">
      <h2 id="studio-pro-extras" className="text-base font-semibold">
        {X.title}
      </h2>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="h-11" onClick={onHistory}>
          <History aria-hidden="true" className="size-4" />
          {STUDIO_COPY.history.open}
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={() => setSendOpen(true)}>
          <Send aria-hidden="true" className="size-4" />
          {STUDIO_COPY.approvalSend.open}
        </Button>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        <SoonTile title={X.canva.title} description={X.canva.description} />
        <SoonTile title={X.testTwo.title} description={X.testTwo.description} />
      </ul>
      <ApprovalSendSheet creativeId={creativeId} open={sendOpen} onOpenChange={setSendOpen} previews={sendable} canMake={canMake} />
    </section>
  );
}
