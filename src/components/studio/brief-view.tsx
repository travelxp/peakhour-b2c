import Link from "next/link";
import { ImageOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { MediaImage } from "@/components/shared/media-image";
import { ComingSoon } from "@/components/studio/coming-soon";
import { QuoteBlock, type QuoteBlockState } from "@/components/studio/studio-quote";
import { RefusalNote } from "@/components/studio/refusal-note";
import type { PostFormat } from "@/lib/api/creative";
import { LINE_MAX, STUDIO_LANGUAGES, STUDIO_PATHS, type PlanBlock, type StudioRefusal } from "@/lib/studio-flow";
import { STUDIO_ROUTES } from "@/lib/studio";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { cn } from "@/lib/utils";

const B = STUDIO_COPY.brief;

export interface BriefProduct {
  id: string;
  title: string;
  photoUrl?: string;
  hasPhoto: boolean;
  smallPhoto?: boolean;
}

export interface BriefViewProps {
  /** loading: the idea or the plan is still being read. */
  status: "loading" | "ready";
  /** The idea in the link has passed (it is not in today's list). */
  ideaGone?: boolean;
  products: BriefProduct[];
  line: string;
  linePlaceholder: string;
  language: string;
  format: PostFormat;
  count: 3 | 4;
  noAiPeople: boolean;
  proTools: boolean;
  /** Is making previews switched on? false = the designed coming-soon card replaces the price and the button. */
  previews: "on" | "coming_soon" | "unknown";
  block: PlanBlock | null;
  quote: { state: QuoteBlockState; peaks?: number; units?: number; free?: boolean; onRetry: () => void };
  left: number | null;
  canMake: boolean;
  /** The plan is being saved, or has changes the api has not seen: the button waits. */
  saving: boolean;
  saveFailed: boolean;
  /** "Save this plan" was pressed and worked. */
  planSaved: boolean;
  starting: boolean;
  refusal?: StudioRefusal;
  makeInstead?: { label: string; onPress: () => void };
  brandNudge: boolean;
  onLine: (v: string) => void;
  onLanguage: (v: string) => void;
  onFormat: (v: PostFormat) => void;
  onCount: (v: 3 | 4) => void;
  onNoAiPeople: (v: boolean) => void;
  onChangeProducts: () => void;
  onRemoveProduct: (id: string) => void;
  /** Renders the "Add a photo" control for a product (the Drive picker); a slot so this view stays free of it. */
  addPhoto: (productId: string, title: string) => React.ReactNode;
  onMake: () => void;
  onSave: () => void;
  onRetry: () => void;
  onRequote: () => void;
}

const FORMATS: PostFormat[] = ["feed", "story", "reel"];

function LanguageField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const known = STUDIO_LANGUAGES.some((l) => l.code === value);
  return (
    <div className="space-y-1.5">
      <Label htmlFor="studio-language">{B.language.label}</Label>
      <select
        id="studio-language"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {!known && <option value={value}>{value}</option>}
        {STUDIO_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function CountField({ value, onChange }: { value: 3 | 4; onChange: (v: 3 | 4) => void }) {
  return (
    <div className="space-y-1.5">
      <p id="studio-count-label" className="text-sm font-medium">
        {B.options.count}
      </p>
      <div role="radiogroup" aria-labelledby="studio-count-label" className="flex gap-2">
        {([3, 4] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={value === k}
            onClick={() => onChange(k)}
            className={cn(
              "h-11 flex-1 rounded-md border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
              value === k ? "border-primary bg-primary/10 font-medium" : "bg-background",
            )}
          >
            {B.options.countOption(k)}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The plan (UX spec S3), drawn from what it is told so every state can be rendered and tested: loading, an idea that has passed, the plan
 * with its rows, a product with no photo (the button stays off and says why), a small photo, a quote (loading, the price, unavailable),
 * the Peaks refusal, a viewer, and the designed coming-soon card that replaces the price and the button while previews are not available.
 */
export function BriefView(p: BriefViewProps) {
  if (p.status === "loading") {
    return (
      <div aria-busy="true" aria-label={B.loading} className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }
  if (p.ideaGone) {
    return (
      <ComingSoonFreeCard
        title={B.ideaGone.title}
        description={B.ideaGone.description}
        actions={
          <>
            <Button asChild className="h-11">
              <Link href={STUDIO_ROUTES.new}>{STUDIO_COPY.ideas.startFromScratch}</Link>
            </Button>
            <Button asChild variant="outline" className="h-11">
              <Link href={STUDIO_ROUTES.home}>{B.back}</Link>
            </Button>
          </>
        }
      />
    );
  }
  const blockText = p.block?.kind === "no_photo" ? B.needsPhoto(p.block.title) : p.block?.kind === "no_product" ? B.needsProduct : null;
  const advanced = (
    <>
      <LanguageField value={p.language} onChange={p.onLanguage} />
      <CountField value={p.count} onChange={p.onCount} />
    </>
  );
  const canPress = p.previews === "on" && p.canMake && !p.block && p.quote.state === "quote" && !p.saving && !p.starting;
  return (
    <div className="space-y-5 pb-44 md:pb-28" data-slot="studio-brief">
      {/* 1. What we are making */}
      <section aria-labelledby="studio-kind-label" className="space-y-2">
        <h2 id="studio-kind-label" className="text-sm font-medium">
          {B.kind.label}
        </h2>
        <ul className="grid grid-cols-3 gap-2">
          <li className="rounded-md border border-primary bg-primary/10 p-2 text-center text-sm font-medium" aria-current="true">
            {B.kind.picture}
          </li>
          {[B.kind.words, B.kind.video].map((name) => (
            <li key={name} className="rounded-md border bg-muted/40 p-2 text-center text-sm text-muted-foreground">
              <span className="block">{name}</span>
              <Badge variant="secondary" className="mt-1">
                {STUDIO_COPY.comingSoon.chip}
              </Badge>
            </li>
          ))}
        </ul>
      </section>

      {/* 2. Products */}
      <section aria-labelledby="studio-products-label" className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 id="studio-products-label" className="text-sm font-medium">
            {B.products.label}
          </h2>
          <Button type="button" variant="outline" size="sm" className="h-11 sm:h-8" onClick={p.onChangeProducts}>
            {B.products.change}
          </Button>
        </div>
        {p.products.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{B.products.none}</p>
        ) : (
          <ul className="space-y-2">
            {p.products.map((pr) => (
              <li key={pr.id} className="flex items-center gap-3 rounded-lg border bg-card p-2">
                <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                  {pr.photoUrl ? (
                    <MediaImage src={pr.photoUrl} alt="" width={56} height={56} className="size-full object-cover" />
                  ) : (
                    <ImageOff aria-hidden="true" className="size-5 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{pr.title}</span>
                  {!pr.hasPhoto && <span className="block text-xs text-muted-foreground">{B.products.noPhoto}</span>}
                  {pr.hasPhoto && pr.smallPhoto && <span className="block text-xs text-warning-on-tint">{B.products.smallPhoto}</span>}
                </span>
                {!pr.hasPhoto && p.addPhoto(pr.id, pr.title)}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-11 sm:h-8"
                  aria-label={B.products.remove(pr.title)}
                  onClick={() => p.onRemoveProduct(pr.id)}
                >
                  <X aria-hidden="true" className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 3. The line */}
      <section className="space-y-1.5">
        <Label htmlFor="studio-line">{B.line.label}</Label>
        <Input
          id="studio-line"
          value={p.line}
          maxLength={LINE_MAX}
          placeholder={p.linePlaceholder}
          aria-describedby="studio-line-hint"
          onChange={(e) => p.onLine(e.target.value)}
          className="h-11"
        />
        <p id="studio-line-hint" className="text-xs text-muted-foreground">
          {B.line.hint} {B.line.counter(p.line.length, LINE_MAX)}
        </p>
      </section>

      {/* 4. Where it will go: the shape of the preview */}
      <section aria-labelledby="studio-shape-label" className="space-y-1.5">
        <h2 id="studio-shape-label" className="text-sm font-medium">
          {B.shape.label}
        </h2>
        <div role="radiogroup" aria-labelledby="studio-shape-label" className="grid grid-cols-3 gap-2">
          {FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={p.format === f}
              onClick={() => p.onFormat(f)}
              className={cn(
                "h-11 rounded-md border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                p.format === f ? "border-primary bg-primary/10 font-medium" : "bg-background",
              )}
            >
              {STUDIO_COPY.formats[f]}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{B.shape.hint}</p>
      </section>

      {/* Pro tools: language and the number of previews are on the main screen; otherwise they sit under Options. */}
      {p.proTools && <section className="grid gap-4 sm:grid-cols-2">{advanced}</section>}

      {/* 5. Options */}
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">{B.options.label}</summary>
        <div className="mt-3 space-y-4">
          {!p.proTools && advanced}
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label htmlFor="studio-no-ai-people">{B.options.noAiPeople}</Label>
              <p className="text-xs text-muted-foreground">{B.options.noAiPeopleHint}</p>
            </div>
            <Switch id="studio-no-ai-people" checked={p.noAiPeople} onCheckedChange={p.onNoAiPeople} />
          </div>
        </div>
      </details>

      {p.brandNudge && (
        <p className="text-sm text-muted-foreground">
          {B.brandNudge}{" "}
          <Link href={STUDIO_PATHS.brandKit} className="underline underline-offset-2">
            {B.brandNudgeLink}
          </Link>
        </p>
      )}

      {/* The price and the button: a sticky bar above the tab bar. Previews not available yet: the designed coming-soon card instead. */}
      {p.previews === "coming_soon" ? (
        <ComingSoon
          title={STUDIO_COPY.comingSoon.previews.title}
          description={STUDIO_COPY.comingSoon.previews.description}
          actions={
            <>
              <Button type="button" className="h-11" disabled={!!p.block || p.saving || !p.canMake} onClick={p.onSave}>
                {B.savePlan}
              </Button>
              <Button asChild variant="outline" className="h-11">
                <Link href={STUDIO_ROUTES.home}>{STUDIO_COPY.comingSoon.backToIdeas}</Link>
              </Button>
              <p role="status" aria-live="polite" className="w-full text-sm text-muted-foreground">
                {p.planSaved ? B.planSaved : p.saveFailed ? B.saveFailed : blockText}
              </p>
            </>
          }
        />
      ) : (
        <div
          data-slot="studio-brief-bar"
          className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 border-t bg-background p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] md:bottom-0 md:start-(--sidebar-width,0px)"
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              {p.previews === "unknown" ? (
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {STUDIO_COPY.quote.loading}
                </p>
              ) : p.block ? (
                <p className="text-sm text-muted-foreground" role="status">
                  {blockText}
                </p>
              ) : (
                <QuoteBlock
                  state={p.quote.state}
                  peaks={p.quote.peaks}
                  units={p.quote.units ?? p.count}
                  kind="previews"
                  free={p.quote.free}
                  left={p.left}
                  help
                  onRetry={p.quote.onRetry}
                />
              )}
              {!p.canMake && <p className="text-sm text-muted-foreground">{STUDIO_COPY.refusal.askAnEditorToMake}</p>}
              {p.saveFailed && !p.refusal && <p className="text-sm text-muted-foreground">{B.saveFailed}</p>}
              {!p.block && p.previews === "on" && <p className="text-xs text-muted-foreground">{B.quoteNote}</p>}
            </div>
            <Button type="button" className="h-12 w-full sm:w-auto sm:min-w-44" disabled={!canPress} onClick={p.onMake}>
              {p.starting ? B.starting : B.make(p.count)}
            </Button>
          </div>
          {p.refusal && (
            <div className="mx-auto mt-2 max-w-3xl">
              <RefusalNote refusal={p.refusal} onRetry={p.onRetry} onRequote={p.onRequote} makeInstead={p.makeInstead} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** A plain card (not "coming soon") for the idea that has passed: same shape as the coming-soon card, no chip. */
function ComingSoonFreeCard({ title, description, actions }: { title: string; description: string; actions: React.ReactNode }) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{actions}</div>
    </section>
  );
}
