"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Loader2, Search, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listKitFileCandidates, type KitFileCandidate, type KitScope } from "@/lib/api/brand-kit";
import { fileSize, kitErrorMessage } from "@/lib/brand-kit";

/**
 * Pick a Drive file for the Brand Kit: a logo, a font or a guideline document (Peakhour Drive B2). The Brand Kit holds files by id, so this lists
 * the right kind from Drive. It is not the picker the Composer and Ads use (that one is lane C's); a kit has rules a post does not:
 *   - a logo and a font must be Published (an ad needs a public link, and the kit drops a font without one), so only those are offered;
 *   - the ORGANISATION's kit may hold only files shared with every business, so for that scope the rest are left out, and counted.
 */

export type KitPickKind = "image" | "font" | "document";

const KIND_WORDS: Record<KitPickKind, { title: string; noun: string; plural: string; empty: string }> = {
  image: { title: "Pick a logo", noun: "image", plural: "images", empty: "There are no Published images in Drive yet." },
  font: { title: "Pick a font", noun: "font", plural: "fonts", empty: "There are no Published font files in Drive yet." },
  document: { title: "Pick a guideline file", noun: "document", plural: "documents", empty: "There are no documents in Drive yet." },
};

/** What the list offers for a scope, and how many it held back: the organisation's kit takes shared files only. */
export function offered(items: readonly KitFileCandidate[], scope: KitScope): { shown: KitFileCandidate[]; held: number } {
  if (scope === "business") return { shown: [...items], held: 0 };
  const shown = items.filter((i) => i.shared);
  return { shown, held: items.length - shown.length };
}

export type FileResultsState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; items: KitFileCandidate[] };

export function KitFileResults({
  state,
  kind,
  scope,
  query,
  onPick,
  onUpload,
  onRetry,
}: {
  state: FileResultsState;
  kind: KitPickKind;
  scope: KitScope;
  query: string;
  onPick: (file: KitFileCandidate) => void;
  onUpload?: () => void;
  onRetry: () => void;
}) {
  const words = KIND_WORDS[kind];
  if (state.status === "loading") {
    return (
      <div role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Loading your {words.plural}…
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 py-6 text-sm">
        <span>{state.message}</span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  const { shown, held } = offered(state.items, scope);
  return (
    <div className="flex flex-col gap-3">
      {kind !== "document" && <p className="text-xs text-muted-foreground">Only Published {words.plural} are listed: an ad needs a public link to the file.</p>}
      {held > 0 && (
        <p className="text-xs text-muted-foreground">
          {held === 1 ? "1 file belongs" : `${held} files belong`} to one business and {held === 1 ? "is" : "are"} not listed. The organisation&apos;s kit can hold only files shared with
          every business.
        </p>
      )}
      {shown.length === 0 ? (
        <div className="flex flex-col items-start gap-2 py-6 text-sm">
          <span>{query.trim() ? `Nothing matches “${query.trim()}”. Try different words.` : words.empty}</span>
          {onUpload && !query.trim() && (
            <Button variant="outline" size="sm" onClick={onUpload}>
              Upload a file
            </Button>
          )}
        </div>
      ) : (
        <ul className="grid max-h-80 grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2 overflow-y-auto">
          {shown.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => onPick(f)}
                className="flex min-h-11 w-full flex-col gap-1 rounded-lg border bg-card p-2 text-left text-xs hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                aria-label={`Use ${f.name}`}
              >
                <span className="flex h-16 items-center justify-center overflow-hidden rounded-md bg-muted">
                  {f.kind === "image" && f.publicUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a Drive file's public URL, already on our CDN
                    <img src={f.publicUrl} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                  ) : f.kind === "font" ? (
                    <Type className="size-6 text-muted-foreground" aria-hidden="true" />
                  ) : (
                    <FileText className="size-6 text-muted-foreground" aria-hidden="true" />
                  )}
                </span>
                <span className="truncate font-medium">{f.name}</span>
                <span className="text-muted-foreground">
                  {fileSize(f.sizeBytes)}
                  {f.visibility === "private" ? ", Private" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function KitFilePicker({
  kind,
  scope,
  open,
  onClose,
  onPick,
  onUpload,
}: {
  kind: KitPickKind;
  scope: KitScope;
  open: boolean;
  onClose: () => void;
  onPick: (file: KitFileCandidate) => void;
  /** Lane P's upload tray, when the Drive page gave one. */
  onUpload?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const query = useQuery({
    queryKey: ["brand-kit-files", kind, q],
    queryFn: () => listKitFileCandidates({ kind, q }),
    enabled: open,
  });
  // isPending and not isLoading: a paused query (offline) is pending and not loading, and would otherwise render as an empty list.
  const state: FileResultsState = query.isError
    ? { status: "error", message: kitErrorMessage(query.error, "Drive could not be read. Try again.") }
    : query.isPending
      ? { status: "loading" }
      : { status: "ready", items: query.data ?? [] };
  const words = KIND_WORDS[kind];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{words.title}</DialogTitle>
          <DialogDescription>Choose from Drive.</DialogDescription>
        </DialogHeader>
        <form
          role="search"
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQ(draft);
          }}
        >
          <label className="relative flex-1">
            <span className="sr-only">Search {words.plural}</span>
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Search ${words.plural}`} className="pl-9" />
          </label>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        <KitFileResults state={state} kind={kind} scope={scope} query={q} onPick={onPick} onUpload={onUpload} onRetry={() => void query.refetch()} />
      </DialogContent>
    </Dialog>
  );
}
