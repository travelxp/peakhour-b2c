"use client";

import { useRef } from "react";
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { getBrandKit, BRAND_KIT_QUERY_KEY } from "@/lib/api/brand-kit";
import {
  studioApi,
  type BriefBody,
  type BriefPatch,
  type CreativeView,
  type PressKind,
  type PressQuote,
  type PressReceipts,
  type SettingsPatch,
  type ShortlistResponse,
  type TweakOp,
} from "@/lib/api/creative-studio";
import { mergeSettings, type PostFormat, type StudioAvailability } from "@/lib/api/creative";
import { STUDIO_KEYS } from "@/hooks/use-studio";
import { jobsKeys } from "@/hooks/use-jobs";
import { CREDITS_KEY } from "@/hooks/use-credits";
import { usePeaksQuote } from "@/hooks/use-peaks-quote";
import { STUDIO_ACTIONS } from "@/lib/api/peaks";
import { driveAbilities } from "@/lib/drive/files-state";
import { derivePressQuote, groupProducts, isWorking, paletteFromKit, pollInterval, type PressQuoteState } from "@/lib/studio-flow";
import { studioConnectedChannels } from "@/lib/studio-publish";
import { useAuth } from "@/providers/auth-provider";

/** Query keys for the creative flow, in one place so a mutation can name the ones it changes. */
export const FLOW_KEYS = {
  creative: "studio-creative",
  pressQuote: "studio-press-quote",
  shortlist: "studio-shortlist",
  productImages: "studio-product-images",
  placements: "studio-placements",
  /** The batch grid's read (S16): a heart, a skip or a final anywhere changes what it shows. */
  batch: "studio-batch",
} as const;

/** What the signed-in person may do in Studio: an editor and above spend Peaks and change things; a viewer reads (spec 3). */
export function useStudioAbilities(): { canMake: boolean } {
  const { org, orgs } = useAuth();
  const role = orgs?.find((o) => o._id === org?._id)?.role;
  return { canMake: driveAbilities(role).canEdit };
}

function useScope() {
  const { isAuthenticated, org, business } = useAuth();
  return { ready: isAuthenticated && !!org?._id && !!business?._id, org: org?._id ?? null, business: business?._id ?? null };
}

/**
 * The creative page's one read, polled while anything is being made: every 1.5 s for the first 30 s, then every 4 s, and not at all when
 * nothing is in flight. A refetch on window focus catches up a tab that was in the background. A poll that fails keeps the page as it was.
 */
export function useCreative(id: string | undefined) {
  const s = useScope();
  // When the current spell of work began: the 1.5 s pace is for the first 30 s of each press, not of the page's life.
  const workSince = useRef<number | null>(null);
  return useQuery<CreativeView>({
    queryKey: [FLOW_KEYS.creative, s.org, s.business, id ?? null],
    queryFn: () => studioApi.creative(id!),
    enabled: s.ready && !!id,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => {
      if (!isWorking(q.state.data)) {
        workSince.current = null;
        return false;
      }
      workSince.current ??= Date.now();
      return pollInterval(q.state.data, Date.now() - workSince.current);
    },
  });
}

/**
 * The price of a press, fetched when the surface opens (`enabled`) and kept fresh every five minutes while open: ONE total to show and the
 * receipts to send back. A switched-off use case is `notReleased`, never an error and never a price.
 */
export function usePressQuote(id: string | undefined, kind: PressKind, count: number | undefined, enabled: boolean): PressQuoteState & { refetch: () => Promise<unknown> } {
  const s = useScope();
  const on = enabled && s.ready && !!id;
  const q = useQuery<PressQuote>({
    queryKey: [FLOW_KEYS.pressQuote, s.org, s.business, id ?? null, kind, count ?? null],
    queryFn: () => studioApi.pressQuote(id!, kind, count),
    enabled: on,
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchInterval: on ? 5 * 60 * 1000 : false,
  });
  const state = derivePressQuote({
    enabled: on,
    // eslint-disable-next-line react-hooks/purity -- reading the clock during render is how a lapsed receipt is withheld; the refetch above closes the window
    now: Date.now(),
    isFetching: q.isFetching,
    data: q.data,
    error: q.error,
  });
  return { ...state, refetch: q.refetch };
}

/** The price of Make final for `units` previews (the Peaks quote of `creative.make_final`). */
export function useFinalQuote(units: number, enabled: boolean) {
  return usePeaksQuote(STUDIO_ACTIONS.makeFinal, enabled && units >= 1, { units });
}

/** Everything waiting: hearted previews, and previews whose heart a change lapsed. Polled while a final is on its way. */
export function useShortlist(enabled = true) {
  const s = useScope();
  return useQuery<ShortlistResponse>({
    queryKey: [FLOW_KEYS.shortlist, s.org, s.business],
    queryFn: () => studioApi.shortlist(),
    enabled: enabled && s.ready,
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => (q.state.data?.items.some((i) => i.state === "finalizing") ? 4000 : false),
  });
}

/** The brand kit's colours as the picks of the colour control, with the keys the api answers to. */
export function useStudioPalette(enabled = true) {
  const s = useScope();
  return useQuery({
    queryKey: BRAND_KIT_QUERY_KEY,
    queryFn: getBrandKit,
    select: (kit) => paletteFromKit(kit.effective.colors),
    enabled: enabled && s.ready,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/** The Library's product photos, paged; the picker groups them into products. */
export function useProductImages(enabled = true) {
  const s = useScope();
  const q = useInfiniteQuery({
    queryKey: [FLOW_KEYS.productImages, s.org, s.business],
    queryFn: ({ pageParam }) => studioApi.productImages({ ...(pageParam ? { after: pageParam } : {}), limit: 100 }),
    initialPageParam: "" as string,
    getNextPageParam: (last) => last.next ?? undefined,
    enabled: enabled && s.ready,
    retry: false,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    // Photos arrive while a store import runs: look again until it is done.
    // Only a single page is cheap to look at again: with more pages loaded the merchant is browsing, and an import's progress can wait.
    refetchInterval: (query) =>
      query.state.data?.pages.length === 1 && query.state.data.pages[0]!.imports.some((i) => i.status === "running") ? 5000 : false,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  return { ...q, products: groupProducts(items), imports: q.data?.pages[0]?.imports ?? [] };
}

// ── Mutations ─────────────────────────────────────────────────────────────────────────────────────────────

export function useCreateBrief() {
  return useMutation({ mutationFn: (body: BriefBody) => studioApi.createBrief(body) });
}

export function usePatchBrief(id: string | undefined) {
  return useMutation({ mutationFn: (patch: BriefPatch) => studioApi.patchBrief(id!, patch) });
}

export interface PressVars {
  id: string;
  kind: PressKind;
  count?: number;
  previewId?: string;
  receipts: PressReceipts;
}

/**
 * One charged press (previews, one more, another background, new wording). One call of `mutate` is one click, so it carries one
 * Idempotency-Key. On success the page's read and the balance refresh and the price that was used is thrown away (the next press asks again).
 */
export function usePress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: PressVars) => {
      if (v.kind === "new_background") return studioApi.newBackground(v.id, v.previewId!, v.receipts);
      if (v.kind === "wording") return studioApi.newWording(v.id, v.receipts);
      // "One more" (kind "more") sends no count: the api makes one.
      return studioApi.makePreviews(v.id, v.kind === "more" ? undefined : (v.count ?? 4), v.receipts);
    },
    onSettled: (_data, error, v) => {
      void qc.invalidateQueries({ queryKey: [FLOW_KEYS.creative] });
      void qc.invalidateQueries({ queryKey: [CREDITS_KEY] });
      if (!error) {
        // The running-jobs strip should show this press at once.
        void qc.invalidateQueries({ queryKey: jobsKeys.all });
      }
      // A receipt that was used is spent, and one the api refused is never re-sent: the next press must carry a fresh one. After any other
      // failure (a lost connection, a refusal for want of Peaks) the price the merchant saw is still the price, and Try again sends it.
      if (!error || (error instanceof ApiError && error.code === "QUOTE_NOT_HONOURED")) {
        void qc.resetQueries({ predicate: (q) => q.queryKey[0] === FLOW_KEYS.pressQuote && q.queryKey[3] === v.id });
      }
    },
  });
}

/** A free tweak. The answer carries the re-rendered preview, which replaces the old one in the cache at once. */
export function useTweak(creativeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { previewId: string; baseVersion: number; op: TweakOp }) => studioApi.tweak(creativeId, v.previewId, v.baseVersion, v.op),
    // A poll still on its way must not land after the change and put the old version back.
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: [FLOW_KEYS.creative] });
    },
    onSuccess: (r, v) => {
      qc.setQueriesData<CreativeView>({ queryKey: [FLOW_KEYS.creative] }, (old) =>
        old && old.id === creativeId
          ? {
              ...old,
              approval: r.approval,
              // The tweak answer has no product names (the api builds it without them): keep the one the page already holds.
              previews: old.previews.map((p) => (p.id === v.previewId ? { ...r.preview, productTitle: r.preview.productTitle ?? p.productTitle } : p)),
            }
          : old,
      );
      void qc.invalidateQueries({ queryKey: [FLOW_KEYS.shortlist] });
      void qc.invalidateQueries({ queryKey: [FLOW_KEYS.batch] });
    },
    onError: () => {
      // A conflict or a refusal: show whatever is really there now.
      void qc.invalidateQueries({ queryKey: [FLOW_KEYS.creative] });
    },
  });
}

/** The heart. Optimistic: the card changes at once and goes back if the api says no. */
export function useHeart(creativeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { previewId: string; on: boolean }) => studioApi.heart(creativeId, v.previewId, v.on),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: [FLOW_KEYS.creative] });
      const before = qc.getQueriesData<CreativeView>({ queryKey: [FLOW_KEYS.creative] });
      qc.setQueriesData<CreativeView>({ queryKey: [FLOW_KEYS.creative] }, (old) =>
        old && old.id === creativeId
          ? {
              ...old,
              previews: old.previews.map((p) =>
                p.id === v.previewId ? { ...p, liked: v.on, state: v.on ? "shortlisted" : "ready", lapsedBecause: null } : p,
              ),
            }
          : old,
      );
      return { before };
    },
    onError: (_e, _v, ctx) => {
      for (const [key, data] of ctx?.before ?? []) qc.setQueryData(key, data);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [FLOW_KEYS.creative] });
      void qc.invalidateQueries({ queryKey: [FLOW_KEYS.shortlist] });
      void qc.invalidateQueries({ queryKey: [FLOW_KEYS.batch] });
    },
  });
}

/** Take a preview off the shortlist from the Shortlist page (any creative). */
export function useRemoveFromShortlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { creativeId: string; previewId: string }) => studioApi.heart(v.creativeId, v.previewId, false),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [FLOW_KEYS.shortlist] });
      void qc.invalidateQueries({ queryKey: [FLOW_KEYS.creative] });
    },
  });
}

export function useSkip(creativeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { previewId: string; reasons: string[] }) => studioApi.skip(creativeId, v.previewId, v.reasons),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [FLOW_KEYS.creative] });
      void qc.invalidateQueries({ queryKey: [FLOW_KEYS.shortlist] });
      void qc.invalidateQueries({ queryKey: [FLOW_KEYS.batch] });
    },
  });
}

/** Make final for the chosen previews: one press, finals made one after another. */
export function useMakeFinals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { items: Array<{ creativeId: string; previewId: string }>; quoteToken: string | undefined }) =>
      studioApi.makeFinals(v.items, v.quoteToken),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: jobsKeys.all });
      void qc.invalidateQueries({ queryKey: [FLOW_KEYS.creative] });
      void qc.invalidateQueries({ queryKey: [FLOW_KEYS.shortlist] });
      void qc.invalidateQueries({ queryKey: [FLOW_KEYS.batch] });
      void qc.invalidateQueries({ queryKey: ["peaks-quote"] });
      void qc.invalidateQueries({ queryKey: [CREDITS_KEY] });
    },
  });
}

// ── Platform versions, posting and settings (S12, S13, S19) ─────────────────────────────────────────────────

/** The count on the Shortlist tab: hearts only, one cheap read. The key sits under the shortlist's so every change that refreshes the list refreshes this too. */
export function useShortlistCount(enabled = true) {
  const s = useScope();
  return useQuery({
    queryKey: [FLOW_KEYS.shortlist, "count", s.org, s.business],
    queryFn: () => studioApi.shortlistCount(),
    select: (r) => r.count,
    enabled: enabled && s.ready,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

/** Which Studio channels are connected right now (the integrations list, as every other channel surface reads it). */
export function useConnectedChannels(enabled = true) {
  const s = useScope();
  return useQuery({
    queryKey: ["content-hub-integrations", s.org, s.business],
    queryFn: () => api.get<{ integrations: Array<{ provider: string; connected?: boolean; account?: { extra?: Record<string, unknown> } }> }>("/v1/integrations"),
    select: (r) => studioConnectedChannels(r.integrations),
    enabled: enabled && s.ready,
    retry: false,
    staleTime: 30_000,
  });
}

/** The sizes the chosen channels offer, for one final. */
export function usePlacements(channels: string[], format: PostFormat, finalId: string, enabled: boolean) {
  const s = useScope();
  const key = [...channels].sort().join(",");
  return useQuery({
    queryKey: [FLOW_KEYS.placements, s.org, s.business, finalId, format, key],
    queryFn: () => studioApi.placements(channels, format, finalId),
    select: (r) => r.placements,
    enabled: enabled && s.ready && channels.length > 0,
    retry: false,
    staleTime: 60_000,
  });
}

/** Free: draw the chosen sizes from the final. */
export function useRenderVersions(creativeId: string, finalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (placementKeys: string[]) => studioApi.renderVersions(creativeId, finalId, placementKeys),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [FLOW_KEYS.creative] });
      void qc.invalidateQueries({ queryKey: [FLOW_KEYS.placements] });
    },
  });
}

/** Quoted per size: the sizes that need more background. One click, one Idempotency-Key. */
export function useExtendVersions(creativeId: string, finalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { placementKeys: string[]; quoteToken: string | undefined }) =>
      studioApi.extendVersions(creativeId, finalId, v.placementKeys, v.quoteToken),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: jobsKeys.all });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [FLOW_KEYS.creative] });
      void qc.invalidateQueries({ queryKey: [FLOW_KEYS.placements] });
      void qc.invalidateQueries({ queryKey: ["peaks-quote"] });
      void qc.invalidateQueries({ queryKey: [CREDITS_KEY] });
    },
  });
}

/** "Looks different? Tell us". */
export function useReportMismatch() {
  return useMutation({ mutationFn: (v: { finalId: string; text: string | undefined }) => studioApi.reportMismatch(v.finalId, v.text) });
}

/**
 * Save one change to the Studio settings (or Pro tools) on the spot. The answer is written into the availability read so every screen sees it
 * at once; a refusal puts the page back to what the api holds.
 */
export function useSaveStudioSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SettingsPatch) => studioApi.saveSettings(patch),
    onSuccess: (r) => {
      qc.setQueriesData<StudioAvailability>({ queryKey: [STUDIO_KEYS.availability] }, (old) =>
        old ? { ...old, proTools: r.proTools === true, settings: mergeSettings(old.settings, r.settings) } : old,
      );
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: [STUDIO_KEYS.availability] });
    },
  });
}
