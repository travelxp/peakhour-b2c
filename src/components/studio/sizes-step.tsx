"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/molecules/empty-state";
import { Plug } from "lucide-react";
import { QuoteBlock, type QuoteBlockState } from "@/components/studio/studio-quote";
import { RefusalNote } from "@/components/studio/refusal-note";
import { formatPeaks } from "@/lib/pricing";
import { STUDIO_COPY } from "@/lib/studio-copy";
import type { StudioRefusal } from "@/lib/studio-flow";
import { channelLabel, isTickable, type SizeRowModel, type StudioChannel } from "@/lib/studio-publish";
import { cn } from "@/lib/utils";

const Z = STUDIO_COPY.sizes;

export interface SizesStepViewProps {
  /** Every channel Studio posts to, and whether it is connected. */
  channels: Array<StudioChannel & { connected: boolean }>;
  chosenChannels: ReadonlySet<string>;
  onToggleChannel: (key: string) => void;
  status: "loading" | "error" | "ready";
  rows: SizeRowModel[];
  ticked: ReadonlySet<string>;
  onToggleRow: (key: string) => void;
  /** Making more background is switched on. While it is not, those sizes are shown disabled with the reason. */
  extendOn: boolean;
  /** What ONE size that needs more background costs, from its own quote; undefined while it is being asked. */
  unitPeaks: number | undefined;
  /** How many ticked sizes need more background, and the quote for exactly that many. */
  extendTicked: number;
  quote: { state: QuoteBlockState; peaks?: number; free?: boolean };
  left: number | null;
  proTools: boolean;
  working: boolean;
  refusal?: StudioRefusal;
  makeInstead?: { label: string; onPress: () => void };
  /** The sizes still being made: they come in on their own, the sheet says so. */
  stillMaking: number;
  /** Nothing to post to a viewer. */
  canPost: boolean;
  onRetry: () => void;
  onContinue: () => void;
  onRequote: () => void;
}

/** A small box in the size's own shape, so a merchant sees Story is tall and Feed is square-ish without a ratio or a pixel count. */
function ShapeBox({ width, height }: { width: number | null; height: number | null }) {
  const w = width ?? 1;
  const h = height ?? 1;
  const long = 36;
  const boxW = w >= h ? long : Math.max(14, Math.round((long * w) / h));
  const boxH = h >= w ? long : Math.max(14, Math.round((long * h) / w));
  return <span aria-hidden="true" className="inline-block shrink-0 rounded-sm border bg-muted" style={{ width: boxW, height: boxH }} />;
}

/**
 * Step one of the sheet (UX spec S12): the channels, then a row per size. Sizes are only the verified ones: a channel with none says its sizes are
 * not confirmed, never a guess. A size that needs more background shows its price before it can be chosen and is not ticked for the merchant.
 */
export function SizesStepView(p: SizesStepViewProps) {
  const connected = p.channels.filter((c) => c.connected);
  const grouped = p.channels
    .filter((c) => p.chosenChannels.has(c.key))
    .map((c) => ({ channel: c, rows: p.rows.filter((r) => r.placement.channel === c.key) }));
  const nTicked = p.ticked.size;
  const canGo = p.canPost && nTicked > 0 && !p.working && (p.extendTicked === 0 || p.quote.state === "quote");
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-slot="studio-sizes-step">
      {connected.length === 0 ? (
        <EmptyState
          icon={Plug}
          title={Z.noChannels.title}
          description={Z.noChannels.description}
          action={{ label: Z.noChannels.action, href: "/dashboard/integrations" }}
        />
      ) : (
        <>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{Z.channels}</legend>
            <ul className="flex flex-wrap gap-2">
              {p.channels.map((c) => (
                <li key={c.key}>
                  {c.connected ? (
                    <Label
                      htmlFor={`studio-channel-${c.key}`}
                      className={cn(
                        "flex h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm",
                        p.chosenChannels.has(c.key) ? "border-primary bg-primary/10" : "bg-background",
                      )}
                    >
                      <Checkbox id={`studio-channel-${c.key}`} checked={p.chosenChannels.has(c.key)} onCheckedChange={() => p.onToggleChannel(c.key)} />
                      {c.label}
                    </Label>
                  ) : (
                    <Link
                      href="/dashboard/integrations"
                      className="flex h-11 items-center gap-1.5 rounded-full border border-dashed px-3 text-sm text-muted-foreground"
                      aria-label={`${c.label} ${Z.connect}`}
                    >
                      {c.label}
                      <span className="text-xs underline underline-offset-2">{Z.connect}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </fieldset>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            {p.status === "loading" && (
              <div aria-busy="true" aria-label={Z.loading} className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-14 rounded-lg" />
                ))}
              </div>
            )}
            {p.status === "error" && (
              <div role="alert" className="space-y-2 rounded-lg border p-3 text-sm">
                <p>{Z.loadFailed}</p>
                <Button type="button" size="sm" variant="outline" className="h-11" onClick={p.onRetry}>
                  {STUDIO_COPY.quote.retry}
                </Button>
              </div>
            )}
            {p.status === "ready" &&
              grouped.map(({ channel, rows }) => (
                <fieldset key={channel.key} className="space-y-2">
                  <legend className="text-sm font-semibold">{channel.label}</legend>
                  {rows.length === 0 || rows.every((r) => r.state === "no_spec") ? (
                    <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{Z.sizesFor(channel.label)}</p>
                  ) : (
                    <ul className="space-y-2">
                      {rows.map((r) => {
                        const key = r.placement.key;
                        const needsMore = r.state === "needs_extend" || r.state === "extend_failed";
                        const off = !isTickable(r) || (needsMore && !p.extendOn);
                        const price = needsMore && p.unitPeaks !== undefined ? Z.uses(formatPeaks(p.unitPeaks)) : undefined;
                        const label = r.placement.label;
                        const id = `studio-size-${key}`;
                        const described = r.state === "extending" ? Z.extending : needsMore ? Z.needsMore(label) : Z.ready;
                        return (
                          <li key={key} className={cn("flex items-center gap-3 rounded-lg border p-2", off && "opacity-70")}>
                            <Checkbox
                              id={id}
                              checked={p.ticked.has(key)}
                              disabled={off}
                              onCheckedChange={() => p.onToggleRow(key)}
                              aria-label={`${channelLabel(r.placement.channel)} ${label}, ${described}${price ? `, ${price}` : ""}`}
                            />
                            <Label htmlFor={id} className="flex min-w-0 flex-1 items-center gap-3 py-1">
                              <ShapeBox width={r.placement.width} height={r.placement.height} />
                              <span className="min-w-0">
                                <span className="block text-sm font-medium">{label}</span>
                                <span className="block text-xs text-muted-foreground" aria-live={r.state === "extending" ? "polite" : undefined}>
                                  {described}
                                  {price && ` · ${price}`}
                                </span>
                                {r.state === "extend_failed" && <span className="block text-xs text-muted-foreground">{Z.extendFailed}</span>}
                                {p.proTools && r.placement.width && r.placement.height && (
                                  <span className="block text-xs text-muted-foreground">
                                    {Z.pixels(r.placement.width, r.placement.height)}
                                    {r.placement.specRef && ` · ${Z.checked(new Date(r.placement.specRef.verifiedAt).toLocaleDateString())}`}
                                  </span>
                                )}
                              </span>
                            </Label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </fieldset>
              ))}
            {p.status === "ready" && !p.extendOn && p.rows.some((r) => r.state === "needs_extend") && (
              <p className="text-sm text-muted-foreground">{Z.soon}</p>
            )}
            {p.stillMaking > 0 && (
              <p role="status" className="text-sm">
                {Z.stillMaking(p.stillMaking)}
              </p>
            )}
          </div>

          <div className="space-y-2 border-t pt-3">
            <p className="text-sm text-muted-foreground">{Z.versionsChosen(nTicked)}</p>
            {p.extendTicked > 0 && <QuoteBlock state={p.quote.state} peaks={p.quote.peaks} free={p.quote.free} left={p.left} help onRetry={p.onRequote} />}
            {p.extendTicked === 0 && <p className="text-xs text-muted-foreground">{Z.freeNote}</p>}
            {p.refusal && <RefusalNote refusal={p.refusal} onRetry={p.onContinue} onRequote={p.onRequote} makeInstead={p.makeInstead} />}
            {nTicked === 0 && p.status === "ready" && <p className="text-sm text-muted-foreground">{Z.pickOne}</p>}
            <Button type="button" className="h-12 w-full" disabled={!canGo} aria-busy={p.working} onClick={p.onContinue}>
              {p.working
                ? Z.working
                : p.extendTicked > 0 && p.quote.state === "quote" && p.quote.peaks !== undefined
                  ? Z.continueMake(p.extendTicked, formatPeaks(p.quote.peaks))
                  : Z.continue}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
