import { cn } from "@/lib/utils";

/**
 * Product art for the sample store the /shopify demos run on ("Neel & Co.",
 * an Indian handloom brand). Flat shapes on a tinted tile stand in for product
 * photos until real ones are shot; every demo that shows them is labelled
 * SAMPLE STORE, so nothing here reads as a real merchant.
 */
export type ProductArt = "kurta" | "scarf" | "bag" | "bottle" | "mug";
export type ProductTint = "indigo" | "rose" | "marigold" | "leaf" | "clay";

const TINTS: Record<ProductTint, string> = {
  indigo: "var(--daylight-tint-indigo)",
  rose: "var(--daylight-tint-rose)",
  marigold: "var(--daylight-tint-marigold)",
  leaf: "var(--daylight-tint-leaf)",
  clay: "var(--daylight-tint-clay)",
};

function Shape({ art }: { art: ProductArt }) {
  switch (art) {
    case "kurta":
      return (
        <>
          <path d="M24 6h16l4 6 12 6-4 14-6-3v29H18V29l-6 3-4-14 12-6z" fill="#fff" fillOpacity=".92" />
          <path d="M28 6l4 10 4-10" fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth="2" />
          <path d="M32 16v20" stroke="currentColor" strokeOpacity=".25" strokeWidth="2" />
        </>
      );
    case "scarf":
      return (
        <>
          <path d="M14 8h36v10L40 58H26L16 22z" fill="#fff" fillOpacity=".92" />
          <path d="M22 14h20M24 22h16" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" />
        </>
      );
    case "bag":
      return (
        <>
          <path d="M14 22h36l-3 34H17z" fill="#fff" fillOpacity=".92" />
          <path d="M24 26v-8a8 8 0 0116 0v8" fill="none" stroke="#fff" strokeWidth="4" />
        </>
      );
    case "bottle":
      return (
        <>
          <rect x="26" y="4" width="12" height="8" rx="2" fill="#fff" />
          <path d="M24 12h16v6c6 3 8 7 8 12v26a4 4 0 01-4 4H20a4 4 0 01-4-4V30c0-5 2-9 8-12z" fill="#fff" fillOpacity=".92" />
          <rect x="20" y="32" width="24" height="14" rx="3" fill="currentColor" fillOpacity=".18" />
        </>
      );
    case "mug":
      return (
        <>
          <path d="M12 18h34v30a8 8 0 01-8 8H20a8 8 0 01-8-8z" fill="#fff" fillOpacity=".92" />
          <path d="M46 24h4a7 7 0 010 14h-4" fill="none" stroke="#fff" strokeWidth="5" />
        </>
      );
  }
}

export function ProductTile({
  art,
  tint,
  className,
  iconClassName = "w-3/5",
}: {
  art: ProductArt;
  tint: ProductTint;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("grid place-items-center overflow-hidden", className)}
      style={{ backgroundImage: TINTS[tint] }}
    >
      <svg viewBox="0 0 64 64" className={cn("h-auto text-ink", iconClassName)}>
        <Shape art={art} />
      </svg>
    </span>
  );
}

/** The pill every demo carries, so sample numbers never pass for a merchant's own. */
export function SampleTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "rounded-full border bg-background px-2.5 py-0.5 font-mono text-micro font-semibold tracking-wider text-muted-foreground shadow-sm",
        className,
      )}
    >
      SAMPLE STORE
    </span>
  );
}

/** Peakhour's mark on the Daylight palette: a peak and a rising sun. */
export function PeakMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <path d="M5 24l8-11 4 5 3-4 7 10z" fill="#fff" />
      <circle cx="23" cy="9" r="3" fill="var(--daylight-amber)" />
    </svg>
  );
}
