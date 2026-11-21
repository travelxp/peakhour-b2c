"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ComposeChannel } from "@/lib/compose-channel";
import { useComposeSheet } from "./compose-sheet-provider";

export interface NewPostButtonProps {
  /** The channel the sheet opens on. Left out, the sheet asks which channel. */
  channel?: ComposeChannel;
  label?: string;
  variant?: "default" | "outline";
  className?: string;
  /** Shown but not pressable, for a channel whose post would not go where the page says. */
  disabled?: boolean;
}

/**
 * "New post" on a channel page: opens the page's one compose sheet (see ComposeSheetProvider) with the channel already chosen.
 * Must sit under a <ComposeSheetProvider/>.
 */
export function NewPostButton({ channel, label = "New post", variant = "default", className, disabled }: NewPostButtonProps) {
  const sheet = useComposeSheet();
  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      className={className ?? "gap-1.5"}
      disabled={disabled}
      onClick={() => sheet.open(channel ?? null)}
    >
      <Plus className="size-3.5" /> {label}
    </Button>
  );
}
