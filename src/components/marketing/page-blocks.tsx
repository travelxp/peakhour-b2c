import Link from "next/link";
import DOMPurify from "isomorphic-dompurify";
import { ArrowRight, Check } from "lucide-react";
import type {
  PageBlock,
  HeroBlock,
  PainPointsBlock,
  PillarOutcomesBlock,
  LearnsWithYouBlock,
  FeatureGridBlock,
  CtaBlock,
  CrossLinksBlock,
  RichTextBlock,
  FaqBlock,
  MediaBlock,
} from "@/lib/marketing-pages";

/**
 * Renders the content-as-data blocks of a marketing page (MP-2b) into the v3
 * marketing design system. Server component. Every block type in mkt_pages'
 * union has a renderer here; rich_text HTML is sanitised with DOMPurify before
 * render (the schema marks it app-sanitised — this is that layer).
 */

const eyebrow = (
  <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
);

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-label">
      {eyebrow}
      {children}
    </span>
  );
}

const ctaClass =
  "group inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-6 py-3.5 text-sm font-bold text-brand-contrast shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";

/**
 * Guard CMS/AI-authored URLs before rendering into href/src. Allows only a
 * leading-"/" relative path or an absolute http(s) URL — blocks javascript:,
 * data:, vbscript:, etc. (stored-XSS defence-in-depth). Returns null when
 * unsafe so callers can drop the link/image.
 */
function safeHref(h: string | undefined): string | null {
  if (!h) return null;
  return h.startsWith("/") || /^https?:\/\//i.test(h) ? h : null;
}

function Hero({ b, asH1 = true }: { b: HeroBlock; asH1?: boolean }) {
  const Heading = asH1 ? "h1" : "h2";
  const cta = safeHref(b.ctaHref);
  const img = safeHref(b.imageUrl);
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          {b.eyebrow && <Eyebrow>{b.eyebrow}</Eyebrow>}
          <Heading className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight text-pretty sm:text-5xl">
            {b.headline}
            {b.accent && (
              <>
                {" "}
                <span className="font-serif font-normal italic text-brand-gradient">
                  {b.accent}
                </span>
              </>
            )}
          </Heading>
          {b.lede && <p className="mt-5 max-w-xl text-lg text-muted-foreground">{b.lede}</p>}
          {b.ctaLabel && cta && (
            <div className="mt-8">
              <Link href={cta} className={ctaClass}>
                {b.ctaLabel}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
            </div>
          )}
        </div>
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={b.imageAlt ?? ""}
            className="w-full rounded-2xl border object-cover shadow-xl"
          />
        )}
      </div>
    </section>
  );
}

function PainPoints({ b }: { b: PainPointsBlock }) {
  return (
    <section className="border-t bg-muted/30 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">{b.heading}</h2>
          {b.intro && <p className="mt-3 text-muted-foreground">{b.intro}</p>}
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {b.items.map((item, i) => (
            <div key={`${item.title}-${i}`} className="rounded-2xl border bg-background p-6">
              <p className="font-bold">{item.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PillarOutcomes({ b }: { b: PillarOutcomesBlock }) {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="max-w-3xl text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">
          {b.heading}
        </h2>
        <div className="mt-10 flex flex-col gap-3">
          {b.items.map((item, i) => (
            <div
              key={`${item.pillar}-${i}`}
              className="grid gap-3 rounded-2xl border bg-background p-6 sm:grid-cols-[150px_1fr]"
            >
              <span className="font-bold capitalize">{item.pillar}</span>
              <span className="text-muted-foreground">{item.outcome}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LearnsWithYou({ b }: { b: LearnsWithYouBlock }) {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 p-8 text-zinc-100 shadow-2xl lg:p-12">
          <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">
            {b.heading}
          </h2>
          {b.body && <p className="mt-4 max-w-2xl text-zinc-400">{b.body}</p>}
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {b.timeline.map((t, i) => (
              <div key={`${t.when}-${i}`} className="border-l-2 border-brand/40 pl-4">
                <div className="font-serif text-lg italic text-brand">{t.when}</div>
                <div className="mt-2 text-sm text-zinc-400">{t.what}</div>
              </div>
            ))}
          </div>
          {b.footnote && (
            <p className="mt-8 border-t border-white/10 pt-6 text-sm text-zinc-400">{b.footnote}</p>
          )}
        </div>
      </div>
    </section>
  );
}

function FeatureGrid({ b }: { b: FeatureGridBlock }) {
  return (
    <section className="border-t bg-muted/30 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="max-w-3xl text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">
          {b.heading}
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {b.features.map((f, i) => (
            <div key={`${f.title}-${i}`} className="rounded-2xl border bg-background p-6">
              <div className="flex size-10 items-center justify-center rounded-xl bg-brand-soft">
                <Check className="size-5 text-brand-ink" strokeWidth={2.5} aria-hidden />
              </div>
              <h3 className="mt-3 text-base font-bold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Cta({ b }: { b: CtaBlock }) {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 px-6 py-16 text-center text-zinc-100 shadow-2xl">
          <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-pretty sm:text-4xl">
            {b.headline}
            {b.accent && (
              <>
                {" "}
                <span className="font-serif font-normal italic text-brand-gradient">{b.accent}</span>
              </>
            )}
          </h2>
          {b.body && <p className="mx-auto mt-4 max-w-xl text-zinc-400">{b.body}</p>}
          {b.ctaLabel && safeHref(b.ctaHref) && (
            <Link href={safeHref(b.ctaHref)!} className={`${ctaClass} mt-8 focus-visible:ring-offset-zinc-900`}>
              {b.ctaLabel}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function CrossLinks({ b }: { b: CrossLinksBlock }) {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">{b.heading}</h2>
          {b.intro && <p className="mt-3 text-muted-foreground">{b.intro}</p>}
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {b.links.map((l, i) => {
            const href = safeHref(l.href);
            if (!href) return null;
            return (
              <Link
                key={`${l.href}-${i}`}
                href={href}
                className="group flex items-center gap-3 rounded-2xl border bg-background p-5 transition-all hover:-translate-y-1 hover:border-foreground hover:shadow-md"
              >
                <span className="font-bold">{l.label}</span>
                <ArrowRight className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function RichText({ b }: { b: RichTextBlock }) {
  const clean = DOMPurify.sanitize(b.html);
  return (
    <section className="py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        {b.heading && (
          <h2 className="mb-6 text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">
            {b.heading}
          </h2>
        )}
        <div
          className="prose prose-zinc max-w-none dark:prose-invert"
          // Sanitised above with DOMPurify.
          dangerouslySetInnerHTML={{ __html: clean }}
        />
      </div>
    </section>
  );
}

function Faq({ b }: { b: FaqBlock }) {
  return (
    <section className="border-t bg-muted/30 py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        {b.heading && (
          <h2 className="text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">{b.heading}</h2>
        )}
        <div className="mt-8 flex flex-col gap-3">
          {b.items.map((item, i) => (
            <details
              key={`${item.question}-${i}`}
              className="group rounded-2xl border bg-background p-5 [&_summary]:cursor-pointer"
            >
              <summary className="flex items-center justify-between font-bold list-none marker:content-none [&::-webkit-details-marker]:hidden">
                {item.question}
                <span className="text-brand transition-transform group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Media({ b }: { b: MediaBlock }) {
  const img = safeHref(b.imageUrl);
  if (!img) return null;
  return (
    <section className="py-12">
      <figure className="mx-auto max-w-4xl px-4 sm:px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt={b.alt}
          loading="lazy"
          decoding="async"
          className="w-full rounded-2xl border shadow-md"
        />
        {b.caption && (
          <figcaption className="mt-3 text-center text-sm text-muted-foreground">{b.caption}</figcaption>
        )}
      </figure>
    </section>
  );
}

function renderBlock(
  block: PageBlock,
  index: number,
  firstHeroIndex: number,
): React.ReactNode {
  switch (block.type) {
    case "hero":
      // Exactly one h1 per page: the first hero is the h1, any later hero an h2.
      return <Hero key={index} b={block} asH1={index === firstHeroIndex} />;
    case "pain_points":
      return <PainPoints key={index} b={block} />;
    case "pillar_outcomes":
      return <PillarOutcomes key={index} b={block} />;
    case "learns_with_you":
      return <LearnsWithYou key={index} b={block} />;
    case "feature_grid":
      return <FeatureGrid key={index} b={block} />;
    case "cta":
      return <Cta key={index} b={block} />;
    case "cross_links":
      return <CrossLinks key={index} b={block} />;
    case "rich_text":
      return <RichText key={index} b={block} />;
    case "faq":
      return <Faq key={index} b={block} />;
    case "media":
      return <Media key={index} b={block} />;
    default:
      return null;
  }
}

/** True when the page has no hero block — the caller must supply an h1. */
export function hasHeroBlock(blocks: PageBlock[]): boolean {
  return blocks.some((b) => b.type === "hero");
}

export function PageBlocks({ blocks }: { blocks: PageBlock[] }) {
  const firstHeroIndex = blocks.findIndex((b) => b.type === "hero");
  return <>{blocks.map((block, i) => renderBlock(block, i, firstHeroIndex))}</>;
}
