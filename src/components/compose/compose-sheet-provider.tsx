"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ComposeChannel } from "@/lib/compose-channel";

// Opened on demand, so the sheet and the composers behind it do not ship with the page.
const ComposeNewSheet = dynamic(() => import("./compose-new-sheet").then((mod) => mod.ComposeNewSheet));

interface ComposeSheetApi {
  /**
   * Open the New post sheet, on `channel` when given, else on the channel picker. With `brief`, the composer writes a first draft from it
   * (the "Draft this post" button); it is only text in the box until the merchant publishes or schedules it.
   */
  open: (channel?: ComposeChannel | null, brief?: string) => void;
}

const ComposeSheetContext = createContext<ComposeSheetApi | null>(null);

/**
 * ONE New post sheet per page. Every button on the page (the header's, an empty state's) calls `useComposeSheet().open(channel)`
 * on this provider, so two buttons never mount two sheets. The sheet mounts on the first open and stays for the page's life.
 */
export function ComposeSheetProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ mounted: boolean; open: boolean; channel: ComposeChannel | null; brief: string | null }>({
    mounted: false,
    open: false,
    channel: null,
    brief: null,
  });
  const open = useCallback((channel?: ComposeChannel | null, brief?: string) => {
    setState({ mounted: true, open: true, channel: channel ?? null, brief: brief ?? null });
  }, []);
  const api = useMemo(() => ({ open }), [open]);
  return (
    <ComposeSheetContext.Provider value={api}>
      {children}
      {state.mounted ? (
        <ComposeNewSheet
          open={state.open}
          onOpenChange={(next) => setState((s) => ({ ...s, open: next }))}
          channel={state.channel}
          brief={state.brief}
        />
      ) : null}
    </ComposeSheetContext.Provider>
  );
}

export function useComposeSheet(): ComposeSheetApi {
  const api = useContext(ComposeSheetContext);
  if (!api) throw new Error("useComposeSheet needs a <ComposeSheetProvider> above it");
  return api;
}
