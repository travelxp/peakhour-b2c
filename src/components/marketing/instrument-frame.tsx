import Image from "next/image";
import { Camera } from "lucide-react";
import type { PillarSlug } from "@/lib/pillars";

/**
 * The one treatment every product screenshot gets.
 *
 * A folder of raw PNGs reads as a folder of PNGs. Ten screens shot through the
 * same chrome, radius, rim light and contour bleed read as one product — which
 * is the entire value of having a frame, and the reason the discipline matters
 * more than the frame itself. The moment one screenshot lands unframed, the
 * system is back to being an asset folder.
 *
 * ★NO SCREENSHOT IS FABRICATED HERE. A slot with no image renders an explicit
 * placeholder naming the file it wants. It would be easy to mock a convincing
 * dashboard in HTML and drop it in — and that would put a picture of software
 * that does not exist on a marketing page, which is the one thing an
 * instrument frame must never be used for. An empty frame is honest; an
 * invented one is not.
 */

/**
 * Where each module's screenshot lives once it exists.
 *
 * `null` = not shot yet, and the frame says so. Enabling one is a single line:
 * drop the file in `public/shots/` and put its path here. Deliberately an
 * explicit map rather than a filesystem probe — a build that silently renders
 * or hides a marketing asset depending on what happens to be on disk is not
 * something a reviewer can check.
 *
 * Shoot at 2×, in a viewport ~1440 wide, on a real account with real data.
 */
export const MODULE_SHOTS: Record<
  PillarSlug,
  { src: string | null; caption: string }
> = {
  commerce: {
    src: null,
    caption: "The Commerce cockpit — live catalogue, channel status, and what the assistant answered today.",
  },
  content: {
    src: null,
    caption: "The content calendar — drafts, trusted sources, and what publishes next.",
  },
  growth: {
    src: null,
    caption: "Campaign performance — spend, CPA and the ad sets Growth paused this week.",
  },
  support: {
    src: null,
    caption: "The unified inbox — email, chat, WhatsApp and DMs in one queue, with SLA timers.",
  },
  presence: {
    src: null,
    caption: "Listings and reviews — one canonical record, synced, with replies drafted.",
  },
};

/** The path a missing shot should be dropped at, shown in the placeholder. */
function expectedPath(slug: PillarSlug): string {
  return `public/shots/${slug}.png`;
}

const MARK: Record<PillarSlug, { seed: number; rgb: string }> = {
  commerce: { seed: 11, rgb: "201,130,12" },
  content: { seed: 27, rgb: "142,118,232" },
  growth: { seed: 43, rgb: "16,156,135" },
  support: { seed: 61, rgb: "74,143,224" },
  presence: { seed: 79, rgb: "224,90,147" },
};

export function InstrumentFrame({
  slug,
  moduleName,
}: {
  slug: PillarSlug;
  moduleName: string;
}) {
  const { src, caption } = MODULE_SHOTS[slug];
  const mark = MARK[slug];

  return (
    <figure className="relative isolate">
      {/* A glow in the module's colour under the frame, so the screenshot
          sits on something rather than floating. Was a generated ridge. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-6 -inset-y-8 -z-10 rounded-[2rem] opacity-45 blur-[60px] sm:-inset-x-12"
        style={{ background: `radial-gradient(circle at 50% 45%, rgba(${mark.rgb},.6), transparent 70%)` }}
      />

      {/* The rim light is a gradient border: a 1px inset ring of gold that
          catches the frame's top-left, the way a lit object would. */}
      <div className="rounded-2xl bg-[linear-gradient(135deg,rgba(255,201,79,.85),rgba(217,122,6,.35)_50%,rgba(255,201,79,.55))] p-px shadow-2xl">
        <div className="overflow-hidden rounded-[15px] bg-ink">
          {/* Chrome. Not a fake browser — a product chrome bar with the real
              route, which is what the screenshot is actually of. */}
          <div className="flex items-center gap-2 border-b border-ink-line px-3.5 py-2.5">
            <span className="flex gap-1.5" aria-hidden>
              <span className="size-2 rounded-full bg-white/25" />
              <span className="size-2 rounded-full bg-white/25" />
              <span className="size-2 rounded-full bg-white/25" />
            </span>
            <span className="ml-2 truncate text-[0.65rem] text-on-ink-dim">
              peakhour.ai/dashboard/{slug}
            </span>
          </div>

          {src ? (
            <Image
              src={src}
              alt={caption}
              width={2880}
              height={1800}
              className="block h-auto w-full"
              sizes="(min-width: 1024px) 640px, 100vw"
            />
          ) : (
            /* The honest empty state. Sized to the real shot's aspect ratio so
               swapping the image in does not reflow the page around it. */
            <div className="flex aspect-[8/5] flex-col items-center justify-center gap-2.5 px-6 text-center">
              <Camera className="size-5 text-on-ink-dim" strokeWidth={1.5} aria-hidden />
              <p className="text-sm font-bold text-on-ink">
                {moduleName} screenshot
              </p>
              <p className="max-w-xs text-xs text-on-ink-dim">{caption}</p>
              <code className="mt-1 rounded-md border border-ink-line bg-white/5 px-2 py-1 text-[0.65rem] text-on-ink-dim">
                {expectedPath(slug)}
              </code>
            </div>
          )}
        </div>
      </div>
      {!src && (
        <figcaption className="mt-3 text-center text-xs text-muted-foreground">
          Placeholder — the frame is final, the image is pending.
        </figcaption>
      )}
    </figure>
  );
}
