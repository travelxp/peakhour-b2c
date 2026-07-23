"use client";

import type { PageBlock, MarketingPageSeo } from "@/lib/marketing-pages";

/** Strip tags from the one rich_text block type so the preview shows readable
 *  text, never live/unsafe markup. */
function toText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const HEADING = "text-sm font-semibold";
const BODY = "text-sm text-muted-foreground";

/** One block, rendered as readable review content — NOT the live marketing design.
 *  Controlled heading levels (h3, under the page's h2) and no clickable links, so
 *  the reviewer reads the whole page without navigating away or breaking a11y. */
function Block({ block }: { block: PageBlock }) {
  switch (block.type) {
    case "hero":
      return (
        <div className="space-y-1">
          {block.eyebrow && (
            <p className="text-xs font-medium uppercase tracking-wide text-brand-label">{block.eyebrow}</p>
          )}
          <h3 className="text-lg font-semibold tracking-tight">
            {block.headline}
            {block.accent ? <span className="text-brand-strong"> {block.accent}</span> : null}
          </h3>
          {block.lede && <p className={BODY}>{block.lede}</p>}
          {block.ctaLabel && <p className="text-xs text-muted-foreground">Button: “{block.ctaLabel}”</p>}
        </div>
      );
    case "pain_points":
      return (
        <div className="space-y-2">
          <h3 className={HEADING}>{block.heading}</h3>
          {block.intro && <p className={BODY}>{block.intro}</p>}
          <ul className="space-y-1.5">
            {block.items.map((it, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{it.title}</span> — <span className="text-muted-foreground">{it.body}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "pillar_outcomes":
      return (
        <div className="space-y-2">
          <h3 className={HEADING}>{block.heading}</h3>
          <ul className="space-y-1.5">
            {block.items.map((it, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium capitalize">{it.pillar}</span>: <span className="text-muted-foreground">{it.outcome}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "learns_with_you":
      return (
        <div className="space-y-2">
          <h3 className={HEADING}>{block.heading}</h3>
          {block.body && <p className={BODY}>{block.body}</p>}
          <ul className="space-y-1.5">
            {block.timeline.map((t, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{t.when}</span> — <span className="text-muted-foreground">{t.what}</span>
              </li>
            ))}
          </ul>
          {block.footnote && <p className="text-xs text-muted-foreground">{block.footnote}</p>}
        </div>
      );
    case "feature_grid":
      return (
        <div className="space-y-2">
          <h3 className={HEADING}>{block.heading}</h3>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {block.features.map((f, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{f.title}</span> — <span className="text-muted-foreground">{f.description}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "faq":
      return (
        <div className="space-y-2">
          <h3 className={HEADING}>{block.heading || "Questions & answers"}</h3>
          <dl className="space-y-2">
            {block.items.map((qa, i) => (
              <div key={i}>
                <dt className="text-sm font-medium">{qa.question}</dt>
                <dd className={BODY}>{qa.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      );
    case "cross_links":
      return (
        <div className="space-y-2">
          <h3 className={HEADING}>{block.heading}</h3>
          {block.intro && <p className={BODY}>{block.intro}</p>}
          <ul className="space-y-1">
            {block.links.map((l, i) => (
              <li key={i} className="text-sm text-muted-foreground">
                {l.label}
              </li>
            ))}
          </ul>
        </div>
      );
    case "cta":
      return (
        <div className="space-y-1 rounded-md bg-muted/50 p-3">
          <h3 className={HEADING}>
            {block.headline}
            {block.accent ? <span className="text-brand-strong"> {block.accent}</span> : null}
          </h3>
          {block.body && <p className={BODY}>{block.body}</p>}
          {block.ctaLabel && <p className="text-xs text-muted-foreground">Button: “{block.ctaLabel}”</p>}
        </div>
      );
    case "rich_text":
      return (
        <div className="space-y-1">
          {block.heading && <h3 className={HEADING}>{block.heading}</h3>}
          <p className={BODY}>{toText(block.html)}</p>
        </div>
      );
    case "media":
      return (
        <p className="text-xs text-muted-foreground">
          Image: {block.alt}
          {block.caption ? ` — ${block.caption}` : ""}
        </p>
      );
    default:
      return null;
  }
}

/** A readable, dashboard-appropriate summary of the page's blocks + its search
 *  snippet — what the reviewer reads before approving. */
export function WebPagePreview({ blocks, seo }: { blocks: PageBlock[]; seo?: MarketingPageSeo }) {
  if (blocks.length === 0) {
    return <p className="p-8 text-center text-sm text-muted-foreground">This page has no content yet.</p>;
  }
  return (
    <div className="space-y-5 p-5">
      {seo?.title && (
        <div className="space-y-0.5 border-b pb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Search result</p>
          <p className="text-sm font-medium text-brand-strong">{seo.title}</p>
          {seo.description && <p className="text-xs text-muted-foreground">{seo.description}</p>}
        </div>
      )}
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}
