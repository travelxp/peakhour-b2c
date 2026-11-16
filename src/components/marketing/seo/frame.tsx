import type { ReactNode } from "react";
import type { PageRecord } from "@/lib/seo/types";
import { cn } from "@/lib/utils";
import { ContextualLinks } from "./contextual-links";
import type { BaseContent } from "./content-types";
import { CtaBand } from "./cta-band";
import { DraftRibbon, isDraftPage } from "./draft-ribbon";
import { FaqSection } from "./faq-section";
import { PageHero } from "./page-hero";
import { ProofStrip } from "./proof-strip";
import { Section } from "./section";
import { cardCls } from "./styles";

/**
 * What every template shares: the draft ribbon, the hero (H1 from the PageRecord, the direct answer from the
 * content), then the template's own sections, then FAQ, related links and the closing band. A template supplies only
 * the middle, in the order Bible section 7 gives its family.
 */
export function Frame({
  page,
  content,
  art,
  heroProof = true,
  children,
}: {
  page: PageRecord;
  content: BaseContent;
  /** Hero art. Defaults to the content's proof, when it has one. */
  art?: ReactNode;
  heroProof?: boolean;
  children: ReactNode;
}) {
  const heroArt = art ?? (heroProof && content.proof ? <ProofStrip proof={content.proof} /> : undefined);
  return (
    // pb-16 on a draft keeps the fixed ribbon off the last lines of the page.
    <main className={isDraftPage(page) ? "pb-16" : undefined}>
      <DraftRibbon page={page} />
      <PageHero
        crumbs={content.crumbs}
        eyebrow={content.eyebrow}
        h1={page.h1}
        directAnswer={content.directAnswer}
        primaryCta={page.primaryCta}
        secondaryCta={content.secondaryCta}
        art={heroArt}
      />
      {/* A page whose hero art is not its proof (a facts card) still shows its proof, as a band. */}
      {art && heroProof && content.proof && (
        <Section id="proof" eyebrow="See it" title="What it looks like.">
          <ProofStrip proof={content.proof} className="max-w-3xl" />
        </Section>
      )}
      {children}
      <FaqSection faqs={content.faqs} />
      {content.related.length > 0 && (
        <Section id="related" eyebrow="Related" title="Related pages" tone="muted">
          <ContextualLinks links={content.related} />
        </Section>
      )}
      <CtaBand headline={content.closing.headline} body={content.closing.body} primary={page.primaryCta} secondary={content.secondaryCta} />
    </main>
  );
}

/** A short list of facts, for the hero art of a page with no picture (a comparison, a guide, a hub). */
export function FactsCard({ title, facts, className }: { title: string; facts: { label: string; value: ReactNode }[]; className?: string }) {
  return (
    <aside aria-label={title} className={cn(cardCls, "p-5 shadow-[var(--daylight-shadow)] sm:p-6", className)}>
      <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
      <dl className="mt-3 grid gap-3">
        {facts.map((f) => (
          <div key={f.label} className="flex items-baseline justify-between gap-4 border-b pb-3 last:border-b-0 last:pb-0">
            <dt className="text-[15px] text-muted-foreground">{f.label}</dt>
            <dd className="text-right font-bold">{f.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

/** A plain bulleted list in the kit's type. */
export function Bullets({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul role="list" className={cn("grid gap-2 text-[15px]", className)}>
      {items.map((t) => (
        <li key={t} className="flex gap-2.5">
          <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
          {t}
        </li>
      ))}
    </ul>
  );
}

/** Two short lists side by side from sm (prerequisites and approval boundaries, risks and use cases). */
export function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className={cn(cardCls, "p-5 sm:p-6")}>
      <h3 className="text-lg font-extrabold tracking-tight">{title}</h3>
      <Bullets items={items} className="mt-3" />
    </div>
  );
}
