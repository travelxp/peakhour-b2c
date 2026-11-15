import Image from "next/image";
import { ProductTile, SampleTag } from "@/components/marketing/shopify/shopify-art";
import { cn } from "@/lib/utils";
import type { ProofContent } from "./content-types";

/**
 * Proof the page is about a real product: a screenshot, or the /shopify sample-store art. Anything that is not a
 * real screenshot carries a visible "Demo" or "Sample" label (Bible 11.3), so a mock-up never passes for a
 * merchant's own store. The same figure serves as hero art (in a card) and as a band further down.
 */
export function ProofStrip({ proof, className }: { proof: ProofContent; className?: string }) {
  return (
    <figure
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-card p-4 shadow-[var(--daylight-shadow)] sm:p-5",
        className,
      )}
    >
      {proof.kind !== "screenshot" && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {proof.title ? <p className="text-sm font-extrabold tracking-tight">{proof.title}</p> : <span />}
          {proof.kind === "sample" ? (
            <SampleTag />
          ) : (
            <span className="rounded-full border bg-background px-2.5 py-0.5 font-mono text-micro font-semibold tracking-wider text-muted-foreground shadow-sm">
              DEMO
            </span>
          )}
        </div>
      )}
      {proof.image ? (
        <Image
          src={proof.image.src}
          alt={proof.image.alt}
          width={proof.image.width}
          height={proof.image.height}
          className="h-auto w-full rounded-xl border"
        />
      ) : (
        proof.tiles && (
          <ul role="list" className="grid grid-cols-3 gap-2.5 sm:gap-3">
            {proof.tiles.map((t) => (
              <li key={t.label} className="min-w-0">
                <ProductTile art={t.art} tint={t.tint} className="aspect-square w-full rounded-xl" />
                <span className="mt-1.5 block truncate text-sm font-semibold">{t.label}</span>
              </li>
            ))}
          </ul>
        )
      )}
      <figcaption className="mt-3 text-sm text-muted-foreground">{proof.caption}</figcaption>
    </figure>
  );
}
