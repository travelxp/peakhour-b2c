"use client";

import { useCallback, useState } from "react";
import {
  importPrefillLogo,
  prefillBrandKit,
  shareFileWithOrganisation,
  type KitScope,
} from "@/lib/api/brand-kit";
import { importSuggestedLogos } from "@/lib/brand-kit-import";
import {
  initialSelection,
  kitErrorMessage,
  mergePrefill,
  prefillFailureNotice,
  toggled,
  type KitDraft,
} from "@/lib/brand-kit";
import type { PrefillState } from "./prefill-review";

/**
 * The website pre-fill as the page and onboarding both use it: read, review, then fold the ticked suggestions into a draft.
 *
 * `apply` returns the draft with what was ticked added. A logo is imported into Drive first (`importSuggestedLogos`).
 */
export function useWebsitePrefill() {
  const [state, setState] = useState<PrefillState>({ status: "idle" });

  const start = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const data = await prefillBrandKit();
      setState({ status: "ready", data, selection: initialSelection(data), applying: false });
    } catch (err) {
      setState({ status: "error", message: kitErrorMessage(err, "We could not read your website. Try again in a moment.") });
    }
  }, []);

  const toggleColor = useCallback(
    (hex: string) => setState((s) => (s.status === "ready" ? { ...s, selection: { ...s.selection, colors: toggled(s.selection.colors, hex) } } : s)),
    [],
  );
  const toggleLogo = useCallback(
    (url: string) => setState((s) => (s.status === "ready" ? { ...s, selection: { ...s.selection, logos: toggled(s.selection.logos, url) } } : s)),
    [],
  );
  const dismiss = useCallback(() => setState({ status: "idle" }), []);

  /** Resolves to the merged draft, or null when there is nothing to apply. A partial import is returned and said so (`complete: false`). */
  const apply = useCallback(
    async (draft: KitDraft, scope: KitScope): Promise<{ draft: KitDraft; complete: boolean } | null> => {
      if (state.status !== "ready") return null;
      const { data, selection } = state;
      setState({ ...state, applying: true, notice: undefined });
      const { imported, failures } = await importSuggestedLogos(selection.logos, scope, { importLogo: importPrefillLogo, share: shareFileWithOrganisation });
      const merged = mergePrefill(draft, data, selection, imported);
      const notice = prefillFailureNotice(failures);
      // The review stays up either way: the caller closes it (`dismiss`) once it has used the draft, so a save that then fails can still show it.
      setState({ status: "ready", data, selection, applying: false, ...(notice ? { notice } : {}) });
      return { draft: merged, complete: !notice };
    },
    [state],
  );

  return { state, start, toggleColor, toggleLogo, dismiss, apply };
}
