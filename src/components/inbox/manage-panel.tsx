"use client";

import { useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { HoldsCard } from "@/components/inbox/legal-hold";
import { canManageHolds } from "@/lib/legal-hold";
import { rangeExportPath } from "@/lib/wa-conversation-export";

/**
 * "Manage": the owner and admin tools in ONE place (Inbox phase 1). The business-wide legal hold and the held list, and the
 * date-range export, used to be stacked cards above the conversations, which on a phone pushed the list off the screen. They open
 * from one button now. The expiry notice stays on the page: it is a warning, not a tool.
 *
 * Nothing renders for anyone who is neither owner nor admin (the api is the real gate).
 */
export function ManagePanel({
  role,
  canExport,
  exporting,
  onRunExport,
  onOpenThread,
}: {
  role: string | null;
  canExport: boolean;
  exporting: boolean;
  /** `null` when the dates are not a usable range; the caller says so. */
  onRunExport: (path: string | null) => void;
  onOpenThread: (threadId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  if (!canManageHolds(role) && !canExport) return null;
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="shrink-0">
          <Settings2 className="size-4" />
          Manage
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Manage conversations</SheetTitle>
          <SheetDescription>Keep conversations past 180 days, or download a copy of them.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {/* Legal holds (H1): the business-wide hold and the held list. Owner/admin only; renders nothing for anyone else. */}
          <HoldsCard
            role={role}
            onOpenThread={(id) => {
              setOpen(false);
              onOpenThread(id);
            }}
          />
          {/* H2: a copy the owner or admin keeps. Nothing is emailed; the file is theirs from the download. */}
          {canExport && (
            <div className="space-y-3 rounded-lg border p-3 text-sm">
              <p className="font-medium">Download conversations</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground" htmlFor="export-from">
                    From
                  </label>
                  <input id="export-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground" htmlFor="export-to">
                    To (optional)
                  </label>
                  <input id="export-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1" />
                </div>
              </div>
              <Button size="sm" variant="outline" disabled={exporting} onClick={() => onRunExport(rangeExportPath(from, to))}>
                {exporting ? "…" : "Export these days"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Download every message in those days as one file. You keep it safe; Peakhour does not email conversations.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
