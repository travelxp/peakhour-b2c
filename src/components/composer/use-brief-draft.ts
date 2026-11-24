"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { AiActionContext, PlatformKey } from "./types";

/**
 * Writes the first draft of a post from a brief, once, when a composer opens with one ("Draft this post" on a What changed line).
 *
 * It is the composer's own Compose action run for the merchant: the same handler the toolbar's Compose chip calls, so the same endpoint, the same
 * price (shown on the button that opened the sheet) and the same charge on delivery. It only fills the text box. Nothing is published or scheduled
 * until the merchant presses the composer's own button, so the result is a draft and only a draft.
 *
 * ★ONCE PER BRIEF. The ref remembers the brief that was run, so a re-render, React's development double-effect or a parent that re-creates the
 * handler never makes a second call (a second call would be a second charge). A new brief is a new run.
 */
/**
 * ★ONCE PER BRIEF PER SESSION, not once per mount: choosing the channel again remounts the composer, and a remount that ran the brief again would be a second charge that
 * overwrites the first draft. A brief whose call FAILED is let go, so Draft this post can be pressed again.
 */
const RUN_THIS_SESSION = new Set<string>();

export function useBriefDraft(
  brief: string | undefined,
  platform: PlatformKey,
  onAiAction: (ctx: AiActionContext) => Promise<string>,
): void {
  const ran = useRef<string | null>(null);
  // The handler changes identity with the composer's state; the effect must not re-run for that.
  const handler = useRef(onAiAction);
  useEffect(() => {
    handler.current = onAiAction;
  });
  useEffect(() => {
    if (!brief || ran.current === brief || RUN_THIS_SESSION.has(`${platform}:${brief}`)) return;
    ran.current = brief;
    RUN_THIS_SESSION.add(`${platform}:${brief}`);
    handler.current({ op: "compose", text: brief, platform }).catch((err: unknown) => {
      RUN_THIS_SESSION.delete(`${platform}:${brief}`);
      // The brief stays in the box's place of nothing: the merchant can write it themselves or press Compose.
      toast.error("We could not write the draft", { description: err instanceof Error ? err.message : undefined });
    });
  }, [brief, platform]);
}
