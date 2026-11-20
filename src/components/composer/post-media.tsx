"use client";

import { useCallback, useMemo, useState } from "react";
import { Loader2, X as XIcon } from "lucide-react";
import { DrivePicker, useDropPaste } from "@/components/drive/drive-picker";
import { MediaImage } from "@/components/shared/media-image";
import type { MediaAsset } from "@/components/composer/types";

/** A picture or file on a post: what a composer sends on (`url` goes in the payload, `id` is the Drive file). */
export interface PostMediaItem {
  id: string;
  url: string;
  mime: string;
  name?: string;
}

/**
 * The pictures on a post, for a composer that takes them (LinkedIn, X). ONE place for the state and the drop/paste: the types, size,
 * count and shape rules are the picker's own (`destination` = this channel's post), so a composer holds no media rule of its own.
 * Pass `dropRef` to the element that takes a drop (the whole composer), and render `<PostMedia/>` where the pictures show.
 */
export function usePostMedia(channel: string, opts: { disabled?: boolean } = {}) {
  const [media, setMedia] = useState<PostMediaItem[]>([]);
  const [refusals, setRefusals] = useState<{ name: string; reason: string }[]>([]);
  /** A file already on the post is not added twice. */
  const add = useCallback((assets: MediaAsset[]) => {
    setMedia((prev) => {
      // by the file, not only its link: a Private file's signed link is new every time it is chosen
      const haveUrl = new Set(prev.map((m) => m.url));
      const haveId = new Set(prev.map((m) => m.id));
      const next = [...prev];
      for (const a of assets) {
        if (haveUrl.has(a.url) || haveId.has(a.id)) continue;
        next.push({ id: a.id, url: a.url, mime: a.mime, name: a.name });
        haveUrl.add(a.url);
        haveId.add(a.id);
      }
      return next;
    });
  }, []);
  const removeAt = useCallback((i: number) => setMedia((prev) => prev.filter((_, j) => j !== i)), []);
  const clear = useCallback(() => {
    setMedia([]);
    setRefusals([]);
  }, []);
  const drop = useDropPaste<HTMLDivElement>({
    destination: { kind: "post", channel },
    attached: media.length,
    disabled: opts.disabled,
    onAdd: add,
    onRefuse: setRefusals,
  });
  const urls = useMemo(() => media.map((m) => m.url), [media]);
  const ids = useMemo(() => media.map((m) => m.id), [media]);
  return {
    media,
    /** What a payload carries: the links (scheduler, X) and the Drive ids (LinkedIn publish). */
    urls,
    ids,
    refusals,
    clearRefusals: () => setRefusals([]),
    add,
    removeAt,
    clear,
    dropRef: drop.ref,
    dropping: drop.dragging,
    adding: drop.busy,
    channel,
  };
}

export type PostMediaState = ReturnType<typeof usePostMedia>;

/** The class that outlines the composer while a file is dragged over it. */
export const dropOutline = (over: boolean) => (over ? "rounded-md ring-2 ring-primary" : undefined);

/** The "add pictures" button, the status line, the refusals (each file turned away, with its reason) and the pictures on the post. */
export function PostMedia({ state, locked = false, hint }: { state: PostMediaState; locked?: boolean; hint?: string }) {
  const { media, refusals, adding } = state;
  return (
    <div className="space-y-2" data-testid="post-media">
      {locked ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <DrivePicker
            destination={{ kind: "post", channel: state.channel }}
            attached={media.length}
            addLabel="Add to post"
            onSelect={(assets) => {
              state.clearRefusals();
              state.add(assets);
            }}
          />
          {hint ? <span className="text-micro text-muted-foreground">{hint}</span> : null}
        </div>
      )}

      {adding ? (
        <p role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="post-media-adding">
          <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden /> Adding your pictures…
        </p>
      ) : null}

      {refusals.length > 0 ? (
        <ul className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert" data-testid="post-media-refusals">
          {refusals.map((r, i) => (
            <li key={`${i}-${r.name}`}>
              {r.name}: {r.reason}
            </li>
          ))}
        </ul>
      ) : null}

      {media.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Attached media">
          {media.map((m, i) => (
            <li key={`${m.url}-${i}`} className="relative size-20 overflow-hidden rounded-md border bg-muted">
              {m.mime.startsWith("video/") ? (
                <span className="flex size-full items-center justify-center p-1 text-center text-micro text-muted-foreground">{m.name ?? "Video"}</span>
              ) : (
                <MediaImage src={m.url} alt={m.name ?? "Attached picture"} width={80} height={80} className="size-full object-cover" />
              )}
              {locked ? null : (
                <button
                  type="button"
                  onClick={() => state.removeAt(i)}
                  className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 shadow"
                  aria-label={`Remove ${m.name ?? "picture"}`}
                >
                  <XIcon className="size-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
