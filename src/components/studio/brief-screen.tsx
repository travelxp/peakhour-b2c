"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Camera } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { DrivePicker } from "@/components/drive/drive-picker";
import { Button } from "@/components/ui/button";
import { BriefView, type BriefProduct } from "@/components/studio/brief-view";
import { ProductPicker } from "@/components/studio/product-picker";
import { usePeaksLeft } from "@/components/studio/studio-quote";
import { BRAND_KIT_QUERY_KEY, getBrandKit } from "@/lib/api/brand-kit";
import { ApiError } from "@/lib/api";
import type { PostFormat, PostIdea } from "@/lib/api/creative";
import type { BriefBody, BriefPatch, BriefWarning } from "@/lib/api/creative-studio";
import {
  useCreateBrief,
  useCreative,
  usePatchBrief,
  usePress,
  usePressQuote,
  useProductImages,
  useStudioAbilities,
} from "@/hooks/use-studio-flow";
import { usePostIdeas, useStudioAvailability, useStudioPrefs } from "@/hooks/use-studio";
import { STUDIO_COPY } from "@/lib/studio-copy";
import {
  affordableUnits,
  isNotReleased,
  linePlaceholder,
  photoMediaIdsFor,
  planBlock,
  receiptsOf,
  STUDIO_PATHS,
  studioRefusal,
  type StudioRefusal,
} from "@/lib/studio-flow";

const B = STUDIO_COPY.brief;

interface Form {
  productIds: string[];
  /** Titles seen for products (the idea's, the Library's), so a row can name a product before its photo has loaded. */
  titles: Record<string, string>;
  /** Photos the merchant chose for a product, over the Library's. */
  photos: Record<string, { mediaId: string; url?: string }>;
  line: string;
  language: string;
  format: PostFormat;
  count: 3 | 4;
  /** undefined until touched: the business setting then decides (the api reads it). */
  noAiPeople: boolean | undefined;
}

const emptyForm = (): Form => ({ productIds: [], titles: {}, photos: {}, line: "", language: "en", format: "feed", count: 4, noAiPeople: undefined });

/**
 * The plan screen (UX spec S3). Where the plan comes from: `?idea=` (an idea of today), `?products=a,b` (a catalog row) or nothing (from
 * scratch); `?c=` is a plan already saved, which a refresh keeps.
 *
 * The plan is saved as it is edited (a draft brief, 800 ms after the last change) once previews are available, because the price of a press
 * is asked of the saved plan. While previews are not available nothing is saved until "Save this plan" is pressed, so no plan piles up
 * for a screen nobody can use. The price is asked when the bar is on screen; the receipts go back on the press.
 */
export function BriefScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const ideaId = params.get("idea");
  const productsParam = params.get("products");
  const savedId = params.get("c");

  const availability = useStudioAvailability();
  const { proTools } = useStudioPrefs();
  const { canMake } = useStudioAbilities();
  const ideas = usePostIdeas();
  const images = useProductImages();
  const left = usePeaksLeft();
  const brandKit = useQuery({ queryKey: BRAND_KIT_QUERY_KEY, queryFn: getBrandKit, staleTime: 5 * 60 * 1000, retry: false });
  const brandEmpty = !!brandKit.data && brandKit.data.effective.colors.length === 0 && brandKit.data.effective.logos.length === 0;

  const idea: PostIdea | undefined = ideaId ? ideas.data?.ideas.find((i) => i.id === ideaId) : undefined;
  const ideaGone = !!ideaId && !savedId && ideas.data !== undefined && !idea;

  const [form, setForm] = useState<Form>(emptyForm);
  const [initialised, setInitialised] = useState(false);
  const [creativeId, setCreativeId] = useState<string | null>(savedId);
  const [synced, setSynced] = useState<string | null>(null);
  /** A saved plan was just read into the form: what the api holds is that form, so it is adopted as saved before anything is sent. */
  const [hydrated, setHydrated] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [planSaved, setPlanSaved] = useState(false);
  const [warnings, setWarnings] = useState<BriefWarning[]>([]);
  const [serverNoAi, setServerNoAi] = useState<boolean | undefined>(undefined);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [refusal, setRefusal] = useState<StudioRefusal | undefined>(undefined);
  const [releasedOff, setReleasedOff] = useState(false);

  const saved = useCreative(savedId ?? undefined);
  const create = useCreateBrief();
  const patch = usePatchBrief(creativeId ?? undefined);
  const press = usePress();

  // Library photos by product, from the Library list (the leading photo of each product).
  const libraryPhoto = useMemo(() => new Map(images.products.map((p) => [p.id, p])), [images.products]);
  const photoLookupDone = images.data !== undefined && !images.hasNextPage;

  // Look for any chosen product the first page of photos did not hold: its photo may be on a later page.
  useEffect(() => {
    if (form.productIds.some((id) => !libraryPhoto.has(id)) && images.hasNextPage && !images.isFetchingNextPage) void images.fetchNextPage();
  }, [form.productIds, libraryPhoto, images]);

  // Start the plan: from a saved plan, an idea, a catalog row's products, or blank.
  useEffect(() => {
    if (initialised) return;
    if (savedId) {
      const v = saved.data;
      if (!v) return;
      setForm({
        productIds: v.brief.productIds,
        titles: {},
        photos: Object.fromEntries(v.brief.photoMediaIds.map((m, i) => [v.brief.productIds[i]!, { mediaId: m }])),
        line: v.brief.line,
        language: v.brief.language,
        format: v.brief.format,
        count: v.brief.count === 3 ? 3 : 4,
        noAiPeople: undefined,
      });
      setServerNoAi(v.brief.noAiPeople);
      setWarnings(v.warnings);
      setHydrated(true);
      setInitialised(true);
      return;
    }
    if (ideaId) {
      if (ideas.data === undefined) return;
      const i = ideas.data.ideas.find((x) => x.id === ideaId);
      if (!i) {
        setInitialised(true);
        return;
      }
      setForm({
        ...emptyForm(),
        productIds: i.productIds.slice(0, 3),
        titles: Object.fromEntries(i.products.map((p) => [p.id, p.title])),
        format: i.format,
      });
      setInitialised(true);
      return;
    }
    setForm({ ...emptyForm(), productIds: (productsParam ?? "").split(",").filter(Boolean).slice(0, 3) });
    setInitialised(true);
  }, [initialised, savedId, saved.data, ideaId, ideas.data, productsParam]);

  // A saved plan that has moved on (previews were made) belongs on the creative page.
  useEffect(() => {
    const status = saved.data?.status;
    if (status && status !== "brief" && status !== "previews_failed") router.replace(STUDIO_PATHS.creative(saved.data!.id));
  }, [saved.data, router]);

  const titleOf = (id: string) => form.titles[id] ?? libraryPhoto.get(id)?.title ?? "";
  const photoOf = (id: string) => form.photos[id]?.mediaId ?? libraryPhoto.get(id)?.photo?.mediaId;
  const hasPhoto = (id: string) => !!photoOf(id);
  const block = photoLookupDone || form.productIds.every(hasPhoto) ? planBlock({ productIds: form.productIds, hasPhoto, titleOf: (id) => titleOf(id) || "your product" }) : form.productIds.length === 0 ? { kind: "no_product" as const } : null;

  const body: BriefBody = {
    kind: "image",
    ...(idea ? { ideaId: idea.id, ideaKind: idea.kind } : {}),
    productIds: form.productIds,
    line: form.line.trim(),
    language: form.language,
    format: form.format,
    ...(form.noAiPeople !== undefined ? { noAiPeople: form.noAiPeople } : {}),
    photoMediaIds: photoMediaIdsFor(form.productIds, photoOf),
    count: form.count,
  };
  const snapshot = JSON.stringify(body);

  const previewsOn = availability.loading ? "unknown" : availability.capabilities.previews === "on" && !releasedOff ? "on" : "coming_soon";
  const canSync = initialised && !hydrated && !ideaGone && previewsOn === "on" && canMake && form.productIds.length > 0 && (photoLookupDone || !!creativeId);
  const dirty = canSync && synced !== snapshot;

  useEffect(() => {
    if (!hydrated) return;
    setSynced(snapshot);
    setHydrated(false);
  }, [hydrated, snapshot]);

  // Save the plan 800 ms after the last change: the first save makes it, later ones change it.
  useEffect(() => {
    if (!canSync || synced === snapshot) return;
    const t = setTimeout(() => {
      void (async () => {
        setSaving(true);
        try {
          if (!creativeId) {
            const r = await create.mutateAsync(body);
            setCreativeId(r.creativeId);
            setWarnings(r.warnings);
            setServerNoAi(r.brief.noAiPeople);
            const next = new URLSearchParams(params.toString());
            next.set("c", r.creativeId);
            router.replace(`${pathname}?${next.toString()}`);
          } else {
            const { kind: _kind, ...rest } = body;
            void _kind;
            const r = await patch.mutateAsync(rest as BriefPatch);
            setWarnings(r.warnings);
            setServerNoAi(r.brief.noAiPeople);
          }
          setSynced(snapshot);
          setSaveFailed(false);
        } catch (e) {
          if (e instanceof ApiError && (e.code === "BRIEF_LOCKED" || e.code === "STATE_CONFLICT") && creativeId) {
            router.replace(STUDIO_PATHS.creative(creativeId));
          } else if (isNotReleased(e)) {
            setReleasedOff(true);
          } else {
            setSaveFailed(true);
            // Do not retry the same body on a loop: the next edit tries again.
            setSynced(snapshot);
          }
        } finally {
          setSaving(false);
        }
      })();
    }, 800);
    return () => clearTimeout(t);
    // The body is derived from the form; its snapshot is the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSync, snapshot, synced, creativeId]);

  const quoteOn = canSync && !!creativeId && !dirty && !saving && !block;
  const quote = usePressQuote(creativeId ?? undefined, "previews", form.count, quoteOn);
  const comingSoon = previewsOn === "coming_soon" || quote.notReleased;

  const savePlan = async () => {
    setSaving(true);
    setSaveFailed(false);
    try {
      if (creativeId) {
        const { kind: _kind, ...rest } = body;
        void _kind;
        await patch.mutateAsync(rest as BriefPatch);
      } else {
        const r = await create.mutateAsync(body);
        setCreativeId(r.creativeId);
      }
      setPlanSaved(true);
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const onMake = () => {
    if (!creativeId) return;
    setRefusal(undefined);
    press.mutate(
      { id: creativeId, kind: "previews", count: form.count, receipts: receiptsOf(quote.quote) },
      {
        onSuccess: () => router.push(STUDIO_PATHS.creative(creativeId)),
        onError: (e) => {
          const r = studioRefusal(e, "Making previews");
          // Switched off while the merchant was here: the same designed card, no error and no toast.
          if (r.tone === "not_released") setReleasedOff(true);
          else setRefusal(r);
        },
      },
    );
  };

  const unitPeaks = quote.quote?.main.perUnit?.peaksPerUnit;
  const instead = refusal?.code === "CREDITS_EXHAUSTED" ? affordableUnits(refusal.left, unitPeaks, form.count) : undefined;
  const makeInstead =
    instead !== undefined && instead >= 3
      ? { label: STUDIO_COPY.refusal.makeInstead(instead, "previews"), onPress: () => { setForm((f) => ({ ...f, count: 3 })); setRefusal(undefined); } }
      : undefined;

  const warnFor = (id: string) => warnings.find((w) => w.productId === id && w.code === "SMALL_PHOTO");
  const products: BriefProduct[] = form.productIds.map((id) => ({
    id,
    title: titleOf(id) || "Product",
    photoUrl: form.photos[id]?.url ?? libraryPhoto.get(id)?.photo?.url,
    hasPhoto: hasPhoto(id),
    smallPhoto: !!warnFor(id),
  }));

  const festival = idea?.kind === "festival" && typeof idea.facts.festival === "string" ? idea.facts.festival : null;
  const firstTitle = form.productIds[0] ? titleOf(form.productIds[0]) : null;

  const picked = (ids: string[], list: { id: string; title: string }[]) =>
    setForm((f) => ({ ...f, productIds: ids, titles: { ...f.titles, ...Object.fromEntries(list.map((p) => [p.id, p.title])) } }));

  const status = !initialised ? "loading" : "ready";
  const quoteState = quote.quote ? "quote" : quote.loading ? "loading" : quote.unavailable ? "unavailable" : "loading";

  return (
    <>
      <BriefView
        status={status}
        ideaGone={ideaGone}
        products={products}
        line={form.line}
        linePlaceholder={linePlaceholder({ festival, productTitle: firstTitle })}
        language={form.language}
        format={form.format}
        count={form.count}
        noAiPeople={form.noAiPeople ?? serverNoAi ?? false}
        proTools={proTools}
        previews={comingSoon ? "coming_soon" : previewsOn}
        block={block}
        quote={{
          state: quoteState,
          peaks: quote.quote?.totalPeaks,
          units: form.count,
          free: quote.quote ? quote.quote.totalPeaks === 0 : false,
          onRetry: () => void quote.refetch(),
        }}
        left={left}
        canMake={canMake}
        saving={saving || dirty}
        saveFailed={saveFailed}
        planSaved={planSaved}
        starting={press.isPending}
        refusal={refusal}
        makeInstead={makeInstead}
        brandNudge={brandEmpty}
        onLine={(line) => setForm((f) => ({ ...f, line }))}
        onLanguage={(language) => setForm((f) => ({ ...f, language }))}
        onFormat={(format) => setForm((f) => ({ ...f, format }))}
        onCount={(count) => setForm((f) => ({ ...f, count }))}
        onNoAiPeople={(v) => setForm((f) => ({ ...f, noAiPeople: v }))}
        onChangeProducts={() => setPickerOpen(true)}
        onRemoveProduct={(id) => setForm((f) => ({ ...f, productIds: f.productIds.filter((x) => x !== id) }))}
        addPhoto={(productId, title) => (
          <DrivePicker
            kinds={["image"]}
            tabs={["drive", "upload"]}
            maxSelection={1}
            requirePublicUrl={false}
            addLabel={B.products.addPhoto}
            trigger={
              <Button type="button" variant="outline" size="sm" className="h-11 sm:h-8" aria-label={`${B.products.addPhoto}: ${title}`}>
                <Camera aria-hidden="true" className="size-4" />
                {B.products.addPhoto}
              </Button>
            }
            onSelect={(assets) => {
              const a = assets[0];
              if (a) setForm((f) => ({ ...f, photos: { ...f.photos, [productId]: { mediaId: a.id, url: a.url || undefined } } }));
            }}
          />
        )}
        onMake={onMake}
        onSave={() => void savePlan()}
        onRetry={onMake}
        onRequote={() => setRefusal(undefined)}
      />
      <ProductPicker open={pickerOpen} onOpenChange={setPickerOpen} selected={form.productIds} onChange={picked} />
    </>
  );
}
