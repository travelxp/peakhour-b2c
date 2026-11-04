"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import {
  BRAND_KIT_QUERY_KEY,
  getBrandKit,
  getFileLink,
  removeBusinessKit,
  saveBrandKit,
  type KitFileCandidate,
  type KitGuideline,
  type KitScope,
} from "@/lib/api/brand-kit";
import {
  addColor,
  addFont,
  addGuideline,
  addLogo,
  draftFromView,
  draftIsSaved,
  fontHint,
  kitErrorMessage,
  kitPermissions,
  payloadFromDraft,
  removeAt,
  type KitDraft,
} from "@/lib/brand-kit";
import { BrandKitLoadError, BrandKitOffline, BrandKitSkeleton, BrandKitView } from "./brand-kit-view";
import { KitFilePicker, type KitPickKind } from "./kit-file-picker";
import { PrefillReview } from "./prefill-review";
import { useWebsitePrefill } from "./use-website-prefill";

/**
 * The Brand Kit tab of Drive (Peakhour Drive B2). The Drive page mounts it and passes nothing it does not already have:
 *
 *   <BrandKitTab onUpload={openUploadTray} />
 *
 * `onUpload` is the Drive page's upload tray; the file picker offers it when Drive holds no font or document yet. Leave it off and the picker
 * simply does not show the button.
 *
 * Reads GET /v1/brand-kit, edits a draft of ONE scope at a time (the organisation's kit, admin and owner; one business's own kit, editor and
 * up) and writes it with PUT /org or PUT /business. A viewer sees the kit and cannot change it.
 */
export function BrandKitTab({ onUpload }: { onUpload?: () => void }) {
  const { org, orgs, business } = useAuth();
  const queryClient = useQueryClient();
  const role = orgs.find((o) => o._id === org?._id)?.role;
  const perms = useMemo(() => kitPermissions(role), [role]);
  const businessName = business?.name ?? "";
  const businessId = business?._id ?? "";

  // The kit depends on the active business, so it is part of the key: switching business must not show the other one's kit.
  const queryKey = [...BRAND_KIT_QUERY_KEY, businessId];
  const query = useQuery({ queryKey, queryFn: getBrandKit, enabled: !!businessId });

  const [chosenScope, setChosenScope] = useState<KitScope | null>(null);
  const scope: KitScope | null = chosenScope && perms.scopes.includes(chosenScope) ? chosenScope : perms.defaultScope;

  const data = query.data;
  const savedView = !data ? null : scope === "org" ? data.org : scope === "business" ? data.business : data.effective;
  const saved: KitDraft = useMemo(() => draftFromView(savedView), [savedView]);

  // Unsaved edits belong to one scope and one business: change either and they are not carried over.
  const [edit, setEdit] = useState<{ scope: KitScope | null; businessId: string; draft: KitDraft } | null>(null);
  const draft = edit && edit.scope === scope && edit.businessId === businessId ? edit.draft : saved;
  const dirty = !draftIsSaved(draft, saved);
  const change = (next: KitDraft) => setEdit({ scope, businessId, draft: next });

  const [problem, setProblem] = useState<string | null>(null);
  const [picking, setPicking] = useState<KitPickKind | null>(null);
  const prefill = useWebsitePrefill();

  const save = useMutation({
    mutationFn: async () => {
      if (!scope) throw new Error("Nothing to save");
      await saveBrandKit(scope, payloadFromDraft(draft));
      // Wait for the fresh kit before dropping the draft, so the page never flashes the old one.
      await queryClient.invalidateQueries({ queryKey: BRAND_KIT_QUERY_KEY });
    },
    onSuccess: () => {
      setEdit(null);
      setProblem(null);
      toast.success("Brand Kit saved.");
    },
    onError: (err) => setProblem(kitErrorMessage(err, "The Brand Kit could not be saved. Try again.")),
  });

  const revert = useMutation({
    mutationFn: async () => {
      await removeBusinessKit();
      await queryClient.invalidateQueries({ queryKey: BRAND_KIT_QUERY_KEY });
    },
    onSuccess: () => {
      setEdit(null);
      toast.success("This business now follows the organisation's kit.");
    },
    onError: (err) => setProblem(kitErrorMessage(err, "That could not be changed. Try again.")),
  });

  if (!businessId) return <BrandKitSkeleton />;
  // isPending, not isLoading: a query paused for being offline is pending but not loading, and isLoading would draw an empty page for it.
  if (query.isPending && query.fetchStatus === "paused") return <BrandKitOffline />;
  if (query.isError) return <BrandKitLoadError message={kitErrorMessage(query.error, "Your Brand Kit could not be loaded.")} onRetry={() => void query.refetch()} />;
  if (query.isPending || !data) return <BrandKitSkeleton />;

  const pick = (kind: KitPickKind) => {
    setProblem(null);
    setPicking(kind);
  };
  const took = (r: { ok: true; draft: KitDraft } | { ok: false; reason: string }) => {
    if (r.ok) {
      change(r.draft);
      setProblem(null);
    } else setProblem(r.reason);
  };
  const onPicked = (f: KitFileCandidate) => {
    if (!picking) return;
    const kind = picking;
    setPicking(null);
    if (kind === "image") took(addLogo(draft, { mediaId: f.id, url: f.publicUrl ?? "", mimeType: f.mimeType, name: f.name }));
    else if (kind === "font") took(addFont(draft, { mediaId: f.id, url: f.publicUrl ?? "", mimeType: f.mimeType, family: f.name.replace(/\.[a-z0-9]{2,5}$/i, "").slice(0, 128) }));
    else took(addGuideline(draft, { mediaId: f.id, name: f.name, mimeType: f.mimeType, visibility: f.visibility, ...(f.publicUrl ? { url: f.publicUrl } : {}) }));
  };

  const openGuideline = async (g: KitGuideline) => {
    try {
      // A Published guideline has its public link; a Private one gets a short-lived signed link, so there is never a permanent URL to leak.
      const link = g.url ? { url: g.url } : await getFileLink(g.mediaId);
      window.open(link.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setProblem(kitErrorMessage(err, "That file could not be opened. Try again."));
    }
  };

  const review =
    prefill.state.status === "idle" ? null : (
      <PrefillReview
        state={prefill.state}
        confirmLabel="Use these"
        onToggleColor={prefill.toggleColor}
        onToggleLogo={prefill.toggleLogo}
        onDismiss={prefill.dismiss}
        onRetry={() => void prefill.start()}
        onConfirm={() => {
          if (!scope) return;
          void prefill.apply(draft, scope).then((r) => {
            if (!r) return;
            change(r.draft);
            if (r.complete) prefill.dismiss();
            toast.message("Added to your Brand Kit. Review it, then save.");
          });
        }}
      />
    );

  return (
    <>
      <BrandKitView
        scope={scope}
        scopes={perms.scopes}
        businessName={businessName}
        draft={draft}
        effective={data.effective}
        voice={data.voice}
        websiteUrl={data.websiteUrl}
        dirty={dirty}
        saving={save.isPending}
        error={problem}
        hasOverride={data.business !== null}
        review={review}
        prefillBusy={prefill.state.status === "loading" || (prefill.state.status === "ready" && prefill.state.applying)}
        fontHintText={prefill.state.status === "ready" ? fontHint(prefill.state.data) : null}
        onScope={(s) => {
          setProblem(null);
          prefill.dismiss();
          setChosenScope(s);
        }}
        onSave={() => save.mutate()}
        onDiscard={() => {
          setEdit(null);
          setProblem(null);
        }}
        onRevert={() => revert.mutate()}
        onPrefill={() => void prefill.start()}
        onAddLogo={() => pick("image")}
        onLogoForm={(i, form) => change({ ...draft, logos: draft.logos.map((l, j) => (j === i ? { ...l, form } : l)) })}
        onRemoveLogo={(i) => change({ ...draft, logos: removeAt(draft.logos, i) })}
        onAddColor={(hex, role) => {
          const r = addColor(draft, hex, role);
          if (r.ok) {
            change(r.draft);
            return null;
          }
          return r.reason;
        }}
        onColorRole={(i, role) =>
          change({
            ...draft,
            colors: draft.colors.map((c, j) => {
              if (j !== i) return c;
              const { role: _drop, ...rest } = c;
              void _drop;
              return role ? { ...rest, role } : rest;
            }),
          })
        }
        onRemoveColor={(i) => change({ ...draft, colors: removeAt(draft.colors, i) })}
        onAddFont={() => pick("font")}
        onFontRole={(i, role) => change({ ...draft, fonts: draft.fonts.map((f, j) => (j === i ? { ...f, role } : f)) })}
        onRemoveFont={(i) => change({ ...draft, fonts: removeAt(draft.fonts, i) })}
        onAddGuideline={() => pick("document")}
        onRemoveGuideline={(i) => change({ ...draft, guidelines: removeAt(draft.guidelines, i) })}
        onOpenGuideline={(g) => void openGuideline(g)}
      />
      {scope && picking && (
        <KitFilePicker kind={picking} scope={scope} open onClose={() => setPicking(null)} onPick={onPicked} onUpload={onUpload} />
      )}
    </>
  );
}
