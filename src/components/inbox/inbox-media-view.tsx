"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SaveToDriveButton } from "@/components/drive/save-to-drive";
import { useObjectUrl, useThreadMedia } from "@/hooks/use-inbox-media";
import { useAuth } from "@/providers/auth-provider";
import { driveAbilities } from "@/lib/drive/files-state";
import { humanBytes, mediaActionLabel, mediaOpenError, type MessageMedia } from "@/lib/inbox-media";

/**
 * A shopper's (or a team member's) attachment inside a conversation bubble (Inbox rich messages).
 *
 * ★TAP TO OPEN. Nothing is fetched from WhatsApp until the button is pressed, so a thread of fifty photos asks for none of them, and
 * the file is shown through a short-lived object URL (`useThreadMedia`), never a link anyone could share. A photo or sticker shows in
 * the bubble (press it to see it full size in a new tab), a voice note or video plays in the bubble, a document downloads.
 * THEME TOKENS ONLY, as the bubble (`inbox-ui.test.tsx` checks the markup for a hard-coded colour).
 * A photo, video or document also has "Save to Drive (private)" (D8): Drive keeps those, not a voice note or a sticker.
 */
const SAVEABLE = new Set<MessageMedia["kind"]>(["image", "video", "document"]);

export function BubbleMedia({ threadId, media }: { threadId: string; media: MessageMedia }) {
  const { org, orgs } = useAuth();
  // Saving writes a file to Drive: an editor or above (the api refuses a viewer, so the button is not offered).
  const canSave = driveAbilities(orgs.find((o) => o._id === org?._id)?.role).canEdit;
  if (!canSave || !SAVEABLE.has(media.kind)) return <OpenMedia threadId={threadId} media={media} />;
  return (
    <div>
      <OpenMedia threadId={threadId} media={media} />
      {/* Saved Private: a customer sent this to the business, so it never gets a public address (the api enforces it) */}
      <SaveToDriveButton source={{ from: "inbox", threadId, ref: media.ref }} label="Save to Drive (private)" className="mb-1" />
    </div>
  );
}

function OpenMedia({ threadId, media }: { threadId: string; media: MessageMedia }) {
  const [open, setOpen] = useState(false);
  const file = useThreadMedia(threadId, media.ref, open);
  const url = useObjectUrl(file.data?.blob);
  const label = mediaActionLabel(media);
  const size = humanBytes(media.bytes);

  if (open && file.isError) {
    return (
      <div className="mb-1 space-y-1.5" data-testid="media-error">
        <p role="alert" className="text-xs text-warning-on-tint">
          {mediaOpenError(file.error)}
        </p>
        <Button size="xs" variant="outline" onClick={() => void file.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (open && url && file.data) {
    switch (media.kind) {
      case "image":
      case "sticker":
        return (
          <a href={url} target="_blank" rel="noopener noreferrer" className="mb-1 block" aria-label="Open the photo full size">
            {/* eslint-disable-next-line @next/next/no-img-element -- an object URL of a blob the api returned; there is nothing for the image optimiser to fetch */}
            <img src={url} alt={media.kind === "sticker" ? "Sticker from the shopper" : "Photo in the conversation"} className="max-h-64 max-w-full rounded-md object-contain" />
          </a>
        );
      case "audio":
        return <audio controls src={url} className="mb-1 w-full max-w-64" aria-label="Voice note" />;
      case "video":
        return <video controls src={url} className="mb-1 max-h-64 max-w-full rounded-md" aria-label="Video in the conversation" />;
      case "document":
        return (
          <a href={url} download={file.data.filename ?? media.filename ?? "document"} className="mb-1 inline-block text-sm underline underline-offset-2">
            Save {file.data.filename ?? media.filename ?? "the document"}
            {size ? ` (${size})` : ""}
          </a>
        );
    }
  }

  return (
    <div className="mb-1">
      {/* opening: the fetch, and the one render between the blob arriving and its object URL existing */}
      <Button size="xs" variant="outline" disabled={open && (file.isFetching || Boolean(file.data))} onClick={() => setOpen(true)}>
        {open && (file.isFetching || file.data) ? "Opening…" : label}
      </Button>
      {size ? <span className="ml-2 text-[11px] text-muted-foreground">{size}</span> : null}
    </div>
  );
}
