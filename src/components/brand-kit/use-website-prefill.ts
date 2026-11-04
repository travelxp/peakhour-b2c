"use client";

import { useCallback, useRef, useState } from "react";
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
 * `apply` imports the ticked logos into Drive (`importSuggestedLogos`) and hands back `fold`, a function from a draft to that draft with the
 * suggestions added. It is a function, not a finished draft, because the imports take seconds: the caller applies it to the draft as it is WHEN
 * THEY FINISH, so a colour typed in the meantime is not overwritten by the draft as it was at the click.
 *
 * A run belongs to the review that started it. Closing the review, switching scope or starting again while logos are importing abandons the
 * run: it changes no state and returns null (the files it already made stay in Drive).
 */
export function useWebsitePrefill() {
  const [state, setState] = useState<PrefillState>({ status: "idle" });
  const run = useRef(0);

  const start = useCallback(async () => {
    const mine = ++run.current;
    setState({ status: "loading" });
    try {
      const data = await prefillBrandKit();
      if (run.current !== mine) return;
      setState({ status: "ready", data, selection: initialSelection(data), applying: false });
    } catch (err) {
      if (run.current !== mine) return;
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
  const dismiss = useCallback(() => {
    run.current++;
    setState({ status: "idle" });
  }, []);

  /** Resolves to `fold` and whether every ticked logo came in, or null when there is nothing to apply or the run was abandoned. */
  const apply = useCallback(
    async (scope: KitScope): Promise<{ fold: (draft: KitDraft) => KitDraft; complete: boolean } | null> => {
      if (state.status !== "ready" || state.applying) return null;
      const mine = ++run.current;
      const { data, selection } = state;
      setState({ ...state, applying: true, notice: undefined });
      const { imported, failures } = await importSuggestedLogos(selection.logos, scope, { importLogo: importPrefillLogo, share: shareFileWithOrganisation });
      if (run.current !== mine) return null;
      const notice = prefillFailureNotice(failures);
      // The review stays up either way: the caller closes it (`dismiss`) once it has used the result, so a save that then fails can still show it.
      setState({ status: "ready", data, selection, applying: false, ...(notice ? { notice } : {}) });
      return { fold: (draft) => mergePrefill(draft, data, selection, imported), complete: !notice };
    },
    [state],
  );

  return { state, start, toggleColor, toggleLogo, dismiss, apply };
}
