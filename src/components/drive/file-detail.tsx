"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Globe, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/molecules/confirm-dialog";
import { FileThumb } from "@/components/drive/file-tile";
import { createShareLink, getMedia, getMediaUrl, type MediaItem, type MediaPatch } from "@/lib/api/media";
import { DESCRIBING_LINE, fitsOf, isBeingDescribed, metaLine, usedInHref, usedInLabel, visibilityName, visibilityNote } from "@/lib/drive/copy";

/**
 * The file panel (Main board): name, description, tags, where it is used (with links), what it fits, Published or Private, and the actions.
 * Name, description, tags and alt text edit in place. Nothing here saves on a keystroke: a field has Save and Cancel (Enter saves), so a
 * half-typed word never reaches the api and a failed save leaves what the person typed on screen with a reason.
 */

/** A text field that reads as text until the person chooses to change it. */
export function InlineText({
  label,
  value,
  placeholder,
  multiline = false,
  canEdit,
  onSave,
  display,
}: {
  label: string;
  value: string | undefined;
  placeholder: string;
  multiline?: boolean;
  canEdit: boolean;
  /** Resolve to save; throw to keep the editor open with what was typed. */
  onSave: (next: string) => Promise<void>;
  display?: "title";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (draft.trim() === (value ?? "")) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "That could not be saved. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <div className="group">
        <div className="flex items-start justify-between gap-2">
          <p className={display === "title" ? "text-base font-semibold" : "text-sm leading-relaxed text-foreground/90"}>
            {value ? value : <span className="text-muted-foreground">{placeholder}</span>}
          </p>
          {canEdit && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              aria-label={`Edit ${label}`}
              onClick={() => {
                setDraft(value ?? "");
                setError(null);
                setEditing(true);
              }}
            >
              Edit
            </Button>
          )}
        </div>
      </div>
    );
  }
  const common = {
    value: draft,
    onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
    "aria-label": label,
    autoFocus: true,
    disabled: busy,
  };
  return (
    <div className="space-y-2">
      {multiline ? (
        <Textarea {...common} rows={3} onKeyDown={(e) => e.key === "Escape" && setEditing(false)} />
      ) : (
        <Input
          {...common}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive-on-tint">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function TagEditor({ tags, canEdit, onSave }: { tags: string[]; canEdit: boolean; onSave: (next: string[]) => Promise<void> }) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (next: string[]) => {
    setBusy(true);
    try {
      await onSave(next);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Those tags could not be saved.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.length === 0 && <span className="text-sm text-muted-foreground">No tags yet</span>}
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground/80">
            {t}
            {canEdit && (
              <button type="button" aria-label={`Remove tag ${t}`} disabled={busy} onClick={() => void run(tags.filter((x) => x !== t))} className="rounded-full hover:text-foreground">
                <X aria-hidden className="size-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {canEdit && (
        <Input
          value={draft}
          disabled={busy}
          aria-label="Add a tag"
          placeholder="Add a tag and press Enter"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || !draft.trim()) return;
            e.preventDefault();
            const next = draft.trim();
            if (tags.some((x) => x.toLowerCase() === next.toLowerCase())) {
              setDraft("");
              return;
            }
            setDraft("");
            void run([...tags, next]);
          }}
        />
      )}
    </div>
  );
}

/** The preview: a published image is its own address, a private one is read through a short-lived link, a video shows its poster frame. */
function usePreviewUrl(item: MediaItem): string | undefined {
  const poster = useQuery({
    queryKey: ["drive", "poster", item.posterMediaId],
    queryFn: () => getMedia(item.posterMediaId!),
    enabled: item.kind === "video" && !!item.posterMediaId,
    staleTime: 5 * 60_000,
  });
  const signed = useQuery({
    queryKey: ["drive", "preview-url", item.id],
    queryFn: () => getMediaUrl(item.id),
    enabled: item.visibility === "private" && item.kind === "image",
    staleTime: 60_000,
  });
  if (item.kind === "image") return item.publicUrl ?? signed.data?.url;
  if (item.kind === "video") return poster.data?.publicUrl;
  return undefined;
}

export function FileDetail({
  item,
  now,
  canEdit,
  onPatch,
  onTrash,
  trashing,
}: {
  item: MediaItem;
  now: Date;
  /** The person may change this file (an editor on the business's own file, an admin on a shared one). */
  canEdit: boolean;
  onPatch: (patch: MediaPatch) => Promise<void>;
  onTrash: () => void;
  trashing: boolean;
}) {
  const preview = usePreviewUrl(item);
  const fits = fitsOf(item.channelFit);
  const describing = isBeingDescribed(item, now);
  const [busy, setBusy] = useState<null | "open" | "share">(null);

  const open = async () => {
    setBusy("open");
    try {
      const r = await getMediaUrl(item.id);
      window.open(r.url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("That file could not be opened. Try again in a moment.");
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    setBusy("share");
    try {
      if (item.visibility === "published") {
        await navigator.clipboard.writeText(item.publicUrl ?? "");
        toast.success("Link copied. It stays the same for as long as the file is here.");
      } else {
        const r = await createShareLink(item.id, { expiresInDays: 7 });
        await navigator.clipboard.writeText(r.url);
        toast.success("Link copied. It stops working in 7 days.");
      }
    } catch {
      toast.error("A link could not be made. Try again in a moment.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <aside aria-label="File details" className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="relative h-40 overflow-hidden rounded-lg bg-muted">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={item.altText ?? item.name} className="size-full object-contain" />
        ) : (
          <FileThumb item={item} />
        )}
        {describing && (
          <>
            <div className="drive-shine" aria-hidden />
            <div className="drive-shine drive-shine-warm" aria-hidden />
          </>
        )}
      </div>

      <div className="space-y-1.5">
        <InlineText label="name" display="title" value={item.name} placeholder="Untitled" canEdit={canEdit} onSave={(name) => onPatch({ name })} />
        <p className="text-[13px] text-muted-foreground">{metaLine(item)}</p>
        <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          {item.visibility === "private" ? <Lock aria-hidden className="size-3.5" /> : <Globe aria-hidden className="size-3.5" />}
          <span>
            <span className="font-medium text-foreground">{visibilityName(item.visibility)}.</span> {visibilityNote(item.visibility)}
          </span>
        </p>
        {!canEdit && item.shared && <p className="text-xs text-muted-foreground">Shared across your organisation. Only an admin can change it.</p>}
      </div>

      {describing ? (
        <p role="status" className="text-sm font-medium text-brand-label">
          {DESCRIBING_LINE[item.kind]} Its name, description and tags will appear here in a moment.
        </p>
      ) : (
        <InlineText label="description" multiline value={item.description} placeholder="No description yet" canEdit={canEdit} onSave={(v) => onPatch({ description: v === "" ? null : v })} />
      )}

      <TagEditor tags={item.tags ?? []} canEdit={canEdit} onSave={(tags) => onPatch({ tags })} />

      {item.kind === "image" && !describing && (
        <div className="space-y-1">
          <div className="text-xs font-semibold tracking-wide text-muted-foreground">Alt text</div>
          <InlineText label="alt text" multiline value={item.altText} placeholder="No alt text yet" canEdit={canEdit} onSave={(v) => onPatch({ altText: v === "" ? null : v })} />
        </div>
      )}

      <div>
        <div className="text-xs font-semibold tracking-wide text-muted-foreground">{item.usedInCount > 0 ? "Used in" : "Not used anywhere yet"}</div>
        {item.usedInCount > 0 && (
          <ul className="mt-1.5 flex flex-col gap-1">
            {item.usedIn.map((u) => (
              <li key={`${u.kind}:${u.refId}`}>
                <Link href={usedInHref(u)} className="text-sm text-brand-label underline-offset-2 hover:underline">
                  {usedInLabel(u)}
                </Link>
              </li>
            ))}
            {item.usedInCount > item.usedIn.length && <li className="text-sm text-muted-foreground">and {item.usedInCount - item.usedIn.length} more</li>}
          </ul>
        )}
      </div>

      {(fits.good.length > 0 || fits.possible.length > 0 || fits.poor.length > 0) && (
        <div>
          <div className="text-xs font-semibold tracking-wide text-muted-foreground">Fits</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {fits.good.map((c) => (
              <span key={c} className="rounded-full bg-success/15 px-2 py-0.5 text-xs text-success-on-tint">
                {c}
              </span>
            ))}
            {fits.possible.map((c) => (
              <span key={c} className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground/80">
                {c}, with care
              </span>
            ))}
          </div>
          {fits.poor.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
              {fits.poor.map((p) => (
                <li key={p.label}>
                  Not for {p.label}
                  {p.reason ? `: ${p.reason}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void open()}>
          {busy === "open" ? "Opening…" : "Open"}
        </Button>
        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void share()}>
          {item.visibility === "private" ? "Share link" : "Copy link"}
        </Button>
        {canEdit && (
          <ConfirmDialog
            trigger={
              <Button type="button" variant="outline" className="col-span-2" disabled={trashing}>
                Move to Trash
              </Button>
            }
            title="Move this file to Trash?"
            description={
              item.usedInCount > 0
                ? `It is used in ${item.usedInCount} ${item.usedInCount === 1 ? "place" : "places"}, and those will lose it. It stays in Trash for 30 days, and you can restore it.`
                : "It stays in Trash for 30 days, and you can restore it. It stops counting against your storage now."
            }
            confirmLabel="Move to Trash"
            onConfirm={onTrash}
          />
        )}
      </div>
    </aside>
  );
}
