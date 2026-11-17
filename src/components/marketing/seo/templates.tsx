import Link from "next/link";
import { comparedWith } from "@/content/seo/competitors/hub";
import { articleLd } from "@/lib/seo/structured-data";
import { SITE } from "@/lib/utils";
import { cardLabel } from "@/lib/seo/labels";
import { PAGES } from "@/lib/seo/pages";
import { isPublishable } from "@/lib/seo/publish";
import { pathFor } from "@/lib/seo/resolve";
import type { PageRecord } from "@/lib/seo/types";
import { CapabilityStatus, StatusChip } from "./capability-status";
import { ComparisonTable } from "./comparison-table";
import type {
  ComparisonPageContent,
  DirectoryContent,
  FeatureContent,
  GuideContent,
  HubContent,
  IndustryContent,
  IntegrationContent,
  PlatformContent,
  ShopifyFeatureContent,
  SolutionContent,
} from "./content-types";
import { ContextualLinks } from "./contextual-links";
import { DetailSection } from "./detail-section";
import { DirectoryGrid } from "./directory-grid";
import { Bullets, FactsCard, Frame, ListCard } from "./frame";
import { JsonLd } from "./json-ld";
import { PlatformChooser } from "./platform-chooser";
import { ProofStrip } from "./proof-strip";
import { Section } from "./section";
import { cardCls, linkCls } from "./styles";
import { WorkflowSteps } from "./workflow-steps";
import { linkAttrs, safeHref } from "./safe-href";

/*
 * The nine page templates. Each is one component taking a PageRecord plus a typed content object, and lays its
 * sections out in the order Bible section 7 gives its family. All are server components: no client JS.
 */

/** 7.1 Feature page (cross-platform): proposition, what is verified, channels, workflow, boundaries, integrations, pricing. */
export function FeaturePage({ page, content }: { page: PageRecord; content: FeatureContent }) {
  return (
    <Frame page={page} content={content}>
      <Section id="status" eyebrow="What is verified" title="What it does, and what it does not.">
        <CapabilityStatus status={content.status} limitations={content.limitations} verifiedAt={content.verifiedAt} />
      </Section>
      <Section id="platforms" eyebrow="Where it runs" title="Where it runs" tone="muted">
        <PlatformChooser platforms={content.platforms} />
      </Section>
      <Section id="workflow" eyebrow="How it works" title="From first message to done.">
        <WorkflowSteps steps={content.steps} />
      </Section>
      <Section id="boundaries" eyebrow="Before you start" title="What you need, and where you stay in charge." tone="muted">
        <div className="grid gap-4 md:grid-cols-2">
          <ListCard title="Prerequisites" items={content.prerequisites} />
          <ListCard title="Approval boundaries" items={content.approvalBoundaries} />
        </div>
      </Section>
      <Section id="integrations" eyebrow="Works with" title="Connects to what you already use.">
        <ContextualLinks links={content.integrations} />
        <p className="mt-6 max-w-2xl text-[15px] text-muted-foreground">{content.pricingNote}</p>
      </Section>
    </Frame>
  );
}

/** Bands alternate plain and muted down the page; the status section is band 0 (plain). */
const bandTone = (index: number) => (index % 2 === 0 ? "plain" : "muted");

/** 7.1 Platform variant: installation and setup, the platform-native workflow, permissions only as supported. */
export function ShopifyFeaturePage({ page, content }: { page: PageRecord; content: ShopifyFeatureContent }) {
  // The comparison pages whose table covers this page's capability: published ones only on production, drafts too on dev.
  const compared = comparedWith(page);
  // The fixed bands keep their tones from the status band on, with or without a Compared section, on dev and on production. The FAQ after
  // them is plain, so a Compared band is a band of its own (muted) only when the permissions band before it is plain; when permissions
  // is muted, Compared sits inside that band under a rule, so no two equal tones ever meet.
  const tone = bandTone;
  const comparedBand = compared.length > 0 && bandTone((content.sections?.length ?? 0) + 2) === "plain";
  const comparedInside = compared.length > 0 && !comparedBand;
  return (
    <Frame page={page} content={content}>
      <Section id="status" eyebrow="On Shopify" title="Where this stands on Shopify">
        <CapabilityStatus status={content.status} limitations={content.limitations} verifiedAt={content.verifiedAt} subject="On Shopify" />
      </Section>
      {content.sections?.map((s, i) => (
        <DetailSection key={s.id} section={s} tone={tone(i + 1)} />
      ))}
      <Section id="setup" eyebrow="Set up" title="Install to first result." tone={tone((content.sections?.length ?? 0) + 1)}>
        <WorkflowSteps steps={content.setupSteps} />
      </Section>
      <Section id="permissions" eyebrow="Permissions" title="What the app asks for, and why." tone={tone((content.sections?.length ?? 0) + 2)}>
        {content.permissions.length === 0 ? (
          <p className={`${cardCls} max-w-2xl p-5 text-[15px] text-muted-foreground`}>{content.permissionsNote}</p>
        ) : (
        <>
        <p className="mb-5 max-w-2xl text-lg text-muted-foreground">
          The access the app asks Shopify for, in plain words. Each line names the permission and what it is used for.
        </p>
        <dl className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          {content.permissions.map((p) => (
            <div key={p.name} className={`${cardCls} p-5 sm:[&:last-child:nth-child(odd)]:col-span-2`}>
              <dt className="font-mono text-sm font-bold [overflow-wrap:anywhere]">{p.name}</dt>
              <dd className="mt-1.5 text-[15px] text-muted-foreground">{p.why}</dd>
            </div>
          ))}
        </dl>
        </>
        )}
        <p className="mt-6 text-[15px] text-muted-foreground">
          This page covers Shopify only. For every platform and the full picture, read{" "}
          <Link href={safeHref(content.globalPage.href)} className={linkCls}>
            {content.globalPage.label}
          </Link>
          .
        </p>
        {comparedInside && (
          <div id="compared" className="mt-10 border-t pt-8 scroll-mt-20">
            <h3 className="text-2xl font-extrabold tracking-tight">Compared with other apps.</h3>
            <p className="mt-2 max-w-2xl text-[15px] text-muted-foreground">
              Side-by-side comparisons whose table covers this feature, each with its sources and the date it was checked.
            </p>
            <div className="mt-5">
              <DirectoryGrid items={compared} compact />
            </div>
          </div>
        )}
      </Section>
      {comparedBand && (
        <Section
          id="compared"
          eyebrow="Compare"
          title="Compared with other apps."
          intro="Side-by-side comparisons whose table covers this feature, each with its sources and the date it was checked."
          tone="muted"
        >
          <DirectoryGrid items={compared} compact />
        </Section>
      )}
    </Frame>
  );
}

/** 7.2 Solution page: the problem, the alternatives, the workflow, examples, KPI definitions, prerequisites. */
export function SolutionPage({ page, content }: { page: PageRecord; content: SolutionContent }) {
  return (
    <Frame
      page={page}
      content={content}
      art={
        <FactsCard
          title="At a glance"
          facts={[
            { label: "Steps", value: content.steps.length },
            { label: "KPIs defined", value: content.kpis.length },
            { label: "Before you start", value: `${content.prerequisites.length} things` },
          ]}
        />
      }
    >
      <Section id="problem" eyebrow="The problem" title={content.problem.heading}>
        <p className="max-w-3xl text-lg text-foreground/80">{content.problem.body}</p>
      </Section>
      <Section id="alternatives" eyebrow="Other ways to do it" title="The alternatives, honestly." tone="muted">
        <dl className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {content.alternatives.map((a) => (
            <div key={a.name} className={`${cardCls} p-5`}>
              <dt className="text-lg font-extrabold tracking-tight">{a.name}</dt>
              <dd className="mt-1.5 text-[15px] text-muted-foreground">{a.body}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section id="workflow" eyebrow="The Peakhour way" title="Step by step.">
        <WorkflowSteps steps={content.steps} />
      </Section>
      <Section id="examples" eyebrow="Examples" title="What it looks like in practice." tone="muted">
        <div className="grid gap-3 md:grid-cols-2 md:gap-4">
          {content.examples.map((e) => (
            <div key={e.title} className={`${cardCls} p-5`}>
              <h3 className="text-lg font-extrabold tracking-tight">{e.title}</h3>
              <p className="mt-1.5 text-[15px] text-muted-foreground">{e.body}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section id="kpis" eyebrow="How to measure it" title="The numbers, defined.">
        <dl className="grid gap-4 md:grid-cols-2 md:gap-x-10">
          {content.kpis.map((k) => (
            <div key={k.name} className="border-t-[3px] border-foreground pt-3">
              <dt className="font-extrabold">{k.name}</dt>
              <dd className="mt-1 text-[15px] text-muted-foreground">{k.definition}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 max-w-xl">
          <ListCard title="Before you start" items={content.prerequisites} />
        </div>
      </Section>
    </Frame>
  );
}

/** 7.3 Industry page: the problem, use cases, what the pillars solve, a demo, integrations, risks, platform chooser. */
export function IndustryPage({ page, content }: { page: PageRecord; content: IndustryContent }) {
  return (
    <Frame
      page={page}
      content={content}
      heroProof={false}
      art={
        <FactsCard
          title="This industry"
          facts={[
            { label: "Use cases", value: content.useCases.length },
            { label: "Connections", value: content.integrations.length },
            { label: "Platforms", value: content.platforms.length },
          ]}
        />
      }
    >
      <Section id="problem" eyebrow="The problem" title="What makes this industry different.">
        <p className="max-w-3xl text-lg text-foreground/80">{content.problem}</p>
      </Section>
      <Section id="use-cases" eyebrow="Use cases" title="Where Peakhour helps." tone="muted">
        <ol role="list" className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {content.useCases.map((u) => (
            <li key={u.title} className={`${cardCls} flex flex-col gap-1.5 p-5`}>
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{u.pillar}</span>
              <h3 className="text-lg font-extrabold tracking-tight">{u.title}</h3>
              <p className="text-[15px] text-muted-foreground">{u.body}</p>
            </li>
          ))}
        </ol>
      </Section>
      {content.proof && (
        <Section id="demo" eyebrow="See it" title="A worked example.">
          <ProofStrip proof={content.proof} className="max-w-3xl" />
        </Section>
      )}
      <Section id="integrations" eyebrow="Connections" title="What it connects to." tone={content.proof ? "muted" : "plain"}>
        <ContextualLinks links={content.integrations} />
      </Section>
      <Section id="risks" eyebrow="Know the limits" title="Risks and restrictions." tone={content.proof ? "plain" : "muted"}>
        <div className="max-w-3xl">
          <Bullets items={content.risks} />
        </div>
      </Section>
      <Section id="platforms" eyebrow="Platforms" title="Choose your platform." tone={content.proof ? "muted" : "plain"}>
        <PlatformChooser platforms={content.platforms} />
      </Section>
    </Frame>
  );
}

/** 6.5 Platform page: the surfaces, what each includes, how to get started. */
export function PlatformPage({ page, content }: { page: PageRecord; content: PlatformContent }) {
  return (
    <Frame page={page} content={content}>
      <Section id="platforms" eyebrow="Platforms" title="Where Peakhour runs">
        <PlatformChooser platforms={content.platforms} />
      </Section>
      <Section id="included" eyebrow="What you get" title="What is included, and its status." tone="muted">
        <ul role="list" className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          {content.included.map((i) => (
            <li key={i.label} className={`${cardCls} p-5`}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-extrabold tracking-tight">{i.label}</h3>
                <StatusChip status={i.status} className="shrink-0" />
              </div>
              <p className="mt-1.5 text-[15px] text-muted-foreground">{i.body}</p>
            </li>
          ))}
        </ul>
      </Section>
      <Section id="start" eyebrow="Get started" title="Three steps to your first result.">
        <WorkflowSteps steps={content.steps} />
      </Section>
    </Frame>
  );
}

/** 6.6 Integration page: status and limits, what it does, the data it touches, how to connect. */
export function IntegrationPage({ page, content }: { page: PageRecord; content: IntegrationContent }) {
  return (
    <Frame page={page} content={content}>
      <Section id="status" eyebrow="Status" title="What works today.">
        <CapabilityStatus status={content.status} limitations={content.limitations} verifiedAt={content.verifiedAt} />
      </Section>
      <Section id="does" eyebrow="What it does" title="With this connected." tone="muted">
        <Bullets items={content.does} className="max-w-3xl text-base" />
      </Section>
      <Section id="data" eyebrow="Your data" title="What Peakhour reads, and why.">
        <dl className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          {content.data.map((d) => (
            <div key={d.name} className={`${cardCls} p-5`}>
              <dt className="font-bold">{d.name}</dt>
              <dd className="mt-1.5 text-[15px] text-muted-foreground">{d.why}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section id="connect" eyebrow="Connect" title="How to connect it." tone="muted">
        <WorkflowSteps steps={content.steps} />
      </Section>
    </Frame>
  );
}

/** A reviewer line that is still a placeholder ("Pending review") is process, not proof: the reader sees a byline only once a person has reviewed the page. */
export function isReviewed(reviewer: string): boolean {
  return reviewer.trim() !== "" && !/^\s*(pending|none|tbd)\b/i.test(reviewer);
}

/** The "Written by" name: a named person when the content gives one, otherwise the company. */
export function bylineAuthor(content: { author?: string }): string {
  return content.author?.trim() || SITE.name;
}

function bylineFacts(content: { author?: string; reviewer: string }): { label: string; value: string }[] {
  return [
    { label: "Written by", value: bylineAuthor(content) },
    ...(isReviewed(content.reviewer) ? [{ label: "Reviewed by", value: content.reviewer.trim() }] : []),
  ];
}

/** 7.4 Comparison page (brand-safe): neutral answer, use cases, table, pricing with date, suitability, limits, last checked. */
export function ComparisonPage({ page, content }: { page: PageRecord; content: ComparisonPageContent }) {
  const { comparison, pricing } = content;
  return (
    <Frame
      page={page}
      content={content}
      art={
        <FactsCard
          title="How this was checked"
          facts={[
            { label: "Last checked", value: <time dateTime={comparison.lastChecked}>{comparison.lastChecked}</time> },
            ...bylineFacts(content),
          ]}
        />
      }
    >
      <Section id="use-cases" eyebrow="Who is choosing" title="The buyer use cases we compared.">
        <div className="grid gap-3 md:grid-cols-2 md:gap-4">
          {content.buyerUseCases.map((u) => (
            <div key={u.title} className={`${cardCls} p-5`}>
              <h3 className="text-lg font-extrabold tracking-tight">{u.title}</h3>
              <p className="mt-1.5 text-[15px] text-muted-foreground">{u.body}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section id="compare" eyebrow="Side by side" title="Feature by feature." tone="muted">
        <ComparisonTable comparison={comparison} />
      </Section>
      <Section id="pricing" eyebrow="Pricing" title={`Pricing as listed on each vendor's page, seen ${pricing.asOf}.`}>
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-0 border-collapse text-left text-sm sm:text-[15px]">
            <caption className="sr-only">
              Pricing as listed on each vendor&apos;s page, seen {pricing.asOf}; each row states its currency and region
            </caption>
            <thead className="bg-muted">
              <tr>
                <th scope="col" className="px-2.5 py-3 font-extrabold sm:px-4">Vendor</th>
                <th scope="col" className="px-2.5 py-3 font-extrabold sm:px-4">Plan</th>
                <th scope="col" className="px-2.5 py-3 font-extrabold sm:px-4">Price</th>
                <th scope="col" className="px-2.5 py-3 font-extrabold sm:px-4">Source</th>
              </tr>
            </thead>
            <tbody>
              {pricing.rows.map((r) => (
                <tr key={`${r.vendor}-${r.plan}`} className="border-t">
                  <th scope="row" className="px-2.5 py-3 font-bold sm:px-4">{r.vendor}</th>
                  <td className="px-2.5 py-3 sm:px-4">{r.plan}</td>
                  <td className="px-2.5 py-3 sm:px-4">{r.price}</td>
                  <td className="px-2.5 py-3 sm:px-4">
                    {r.source ? (
                      <a href={safeHref(r.source.href)} {...linkAttrs(r.source.href)} className={linkCls}>
                        {r.source.label}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">No source yet</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section id="suitability" eyebrow="Which fits" title="Best for, by provider." tone="muted">
        <dl className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {content.suitability.map((s) => (
            <div key={s.vendor} className={`${cardCls} p-5`}>
              <dt className="text-lg font-extrabold tracking-tight">{s.vendor}</dt>
              <dd className="mt-1.5 text-[15px] text-muted-foreground">{s.bestFor}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section id="limits" eyebrow="Limits of this page" title="What this comparison cannot tell you.">
        <div className="max-w-3xl">
          <Bullets items={content.limitations} />
          <p className="mt-5 text-sm text-muted-foreground">
            Last checked <time dateTime={comparison.lastChecked}>{comparison.lastChecked}</time>.
            {` Written by ${bylineAuthor(content)}${isReviewed(content.reviewer) ? `, reviewed by ${content.reviewer.trim()}` : ""}.`}
          </p>
        </div>
      </Section>
      {content.more && (
        <Section id="more" eyebrow="Peakhour Suite gives more" title={content.more.heading} intro={content.more.intro} tone="muted">
          <DirectoryGrid items={content.more.items} compact />
          {content.more.links.length > 0 && (
            <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[15px] font-semibold">
              {content.more.links.map((l) => (
                <Link key={l.href} href={safeHref(l.href)} className={linkCls}>
                  {l.label}
                </Link>
              ))}
            </p>
          )}
        </Section>
      )}
    </Frame>
  );
}

/** 7.5 Guide: byline and update date, original instructions in sections, sources, bridges back to the product. */
export function GuidePage({ page, content }: { page: PageRecord; content: GuideContent }) {
  return (
    <Frame
      page={page}
      content={content}
      art={
        <FactsCard
          title="About this guide"
          facts={[...bylineFacts(content), { label: "Updated", value: <time dateTime={content.updatedAt}>{content.updatedAt}</time> }]}
        />
      }
    >
      <JsonLd data={articleLd({ headline: page.h1, path: page.path, author: bylineAuthor(content), dateModified: content.updatedAt })} />
      <section aria-labelledby="guide-h" className="py-12 sm:py-16">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-[14rem_1fr] lg:gap-14">
          <nav aria-label="In this guide" className="lg:sticky lg:top-28 lg:self-start">
            <h2 id="guide-h" className="text-sm font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
              In this guide
            </h2>
            <ol role="list" className="mt-3 grid gap-1.5 text-[15px] font-semibold">
              {content.sections.map((s) => (
                <li key={s.id}>
                  <a href={safeHref(`#guide-${s.id}`)} className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {s.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="min-w-0 max-w-[68ch]">
            {content.sections.map((s) => (
              <section key={s.id} id={`guide-${s.id}`} aria-labelledby={`guide-${s.id}-h`} className="scroll-mt-24 border-t-2 border-foreground pt-5 first:border-t-0 first:pt-0 [&:not(:first-child)]:mt-9">
                <h2 id={`guide-${s.id}-h`} className="text-2xl font-extrabold leading-tight tracking-tight">
                  {s.heading}
                </h2>
                {s.paragraphs.map((p) => (
                  <p key={p} className="mt-3 text-[17px] leading-relaxed text-foreground/85">
                    {p}
                  </p>
                ))}
                {s.list && <Bullets items={s.list} className="mt-3 text-base" />}
              </section>
            ))}
          </div>
        </div>
      </section>
      <Section id="sources" eyebrow="Sources" title="Where this comes from." tone="muted">
        <ul role="list" className="grid gap-2 text-[15px]">
          {content.sources.map((s) => (
            <li key={s.href}>
              <a href={safeHref(s.href)} target="_blank" rel="noopener noreferrer" className={linkCls}>
                {s.label}
              </a>
              {s.note && <span className="text-muted-foreground"> · {s.note}</span>}
            </li>
          ))}
        </ul>
      </Section>
    </Frame>
  );
}

/** A family hub: the cards of its children, each with its own status chip. No count card: the chips on the cards are the status. */
export function DirectoryPage({ page, content }: { page: PageRecord; content: DirectoryContent }) {
  return (
    <Frame page={page} content={content}>
      {content.groups ? (
        content.groups.map((g, i) => (
          <Section key={g.id} id={g.id} eyebrow={g.eyebrow} title={g.title} intro={g.blurb} tone={i % 2 === 1 ? "muted" : "plain"}>
            <DirectoryGrid items={g.items} balanced />
          </Section>
        ))
      ) : (
        <Section id="directory" eyebrow="Everything here" title={content.listTitle ?? "The list"}>
          <DirectoryGrid items={content.items} />
        </Section>
      )}
    </Frame>
  );
}

/**
 * A module hub: what runs today, what is coming soon, where it runs, and the limits.
 *
 * Two faults of the old hub are fixed here once, for every module page. The hero card no longer repeats the status
 * chips of the grid under it: it holds "You stay in charge", the module's own control lines, which no other section
 * says. And no card carries its own "Limit:" footnote: every limit is gathered, once each, in one "What it does not do"
 * block, so a twelve-card page does not read as a wall of small print.
 */
export function HubPage({ page, content }: { page: PageRecord; content: HubContent }) {
  const shipped = content.items.filter((i) => i.status === "live" || i.status === "beta");
  const coming = content.items.filter((i) => i.status !== "live" && i.status !== "beta");
  const limits = hubLimits(content);
  // The hub's publishable feature and integration pages, from the registry's relatedIds, so a page appears here the
  // moment it is publishable and never before. Anything the hub already links in "Related pages" is left out (no duplicates).
  const already = new Set(content.related.map((l) => l.href));
  const children = page.relatedIds
    .map((id) => PAGES.find((p) => p.pageId === id))
    .filter((p): p is PageRecord => !!p && (p.family === "feature" || p.family === "integration") && isPublishable(p))
    .map((p) => ({ label: cardLabel(p), href: pathFor(p.pageId), note: p.description }))
    .filter((l) => !already.has(l.href))
    .slice(0, 6);
  return (
    <Frame
      page={page}
      // A single child would sit alone in its own grid, so it joins the related links instead.
      content={children.length === 1 ? { ...content, related: [...children, ...content.related] } : content}
      art={
        <aside aria-label={content.controlTitle ?? "You stay in charge"} className={`${cardCls} p-5 shadow-[var(--daylight-shadow)] sm:p-6`}>
          <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-muted-foreground">{content.controlTitle ?? "You stay in charge"}</p>
          <Bullets items={content.control} className="mt-3 text-base" />
        </aside>
      }
    >
      {shipped.length > 0 && (
        <Section id="today" eyebrow="Available now" title="What it does today">
          <HubCards items={shipped} />
        </Section>
      )}
      {coming.length > 0 && (
        <Section id="soon" eyebrow="Coming soon" title={content.comingSoonTitle ?? "Coming soon"} tone="muted" intro={content.comingSoonNote || undefined}>
          <HubCards items={coming} />
        </Section>
      )}
      {content.platforms.length > 0 && (
        <Section id="platforms" eyebrow="Where it runs" title={content.platformsTitle ?? "Where it runs"}>
          <PlatformChooser platforms={content.platforms} showLimits={false} />
        </Section>
      )}
      {limits.length > 0 && (
        <Section id="limits" eyebrow="Limits" title="What it does not do" tone={content.platforms.length > 0 ? "muted" : "plain"}>
          <ul role="list" className="grid max-w-4xl gap-2.5 text-[15px] md:grid-cols-2 md:gap-x-10">
            {limits.map((l) => (
              <li key={l.text} className="flex gap-2.5">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground/60" />
                <span>
                  <b className="font-bold">{l.title}: </b>
                  {l.text}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {children.length > 1 && (
        <Section id="deeper" eyebrow="Go deeper" title="Features and connections" tone={limits.length > 0 && content.platforms.length === 0 ? "muted" : "plain"}>
          <ContextualLinks links={children} />
        </Section>
      )}
    </Frame>
  );
}

/** The limits of a hub's cards, each sentence once (two cards on one capability share a limit), keyed by the first card that has it. */
export function hubLimits(content: HubContent): { title: string; text: string }[] {
  const seen = new Set<string>();
  const out: { title: string; text: string }[] = [];
  for (const i of content.items) {
    if (!i.limitation || seen.has(i.limitation)) continue;
    seen.add(i.limitation);
    out.push({ title: i.title, text: i.limitation });
  }
  for (const p of content.platforms) {
    for (const l of p.limitations ?? []) {
      if (seen.has(l)) continue;
      seen.add(l);
      out.push({ title: p.label, text: l });
    }
  }
  for (const l of content.limits ?? []) {
    if (seen.has(l.text)) continue;
    seen.add(l.text);
    out.push(l);
  }
  return out;
}

/**
 * Column classes by card count, so a row is never left with one orphaned card: 1 is one wide card, 3 and 9 split in
 * threes, 2, 4 and 8 in pairs, 6 and 12 either way. 5, 7 and 11 would leave one alone, so a hub keeps each group clear
 * of them (existing-pages.test.tsx holds that).
 */
function hubCols(n: number): string {
  if (n === 1) return "max-w-2xl";
  if (n % 3 === 0 && n % 2 === 1) return "md:grid-cols-3";
  if (n % 3 === 0) return "sm:grid-cols-2 lg:grid-cols-3";
  if (n % 2 === 0) return "sm:grid-cols-2";
  return "sm:grid-cols-2 lg:grid-cols-3";
}

function HubCards({ items }: { items: HubContent["items"] }) {
  return (
    <ul role="list" className={`grid gap-3 sm:gap-4 ${hubCols(items.length)}`}>
      {items.map((i) => (
        <li key={i.title} className={`${cardCls} flex flex-col gap-2 p-5`}>
          <span className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-extrabold tracking-tight">{i.title}</h3>
            <StatusChip status={i.status} className="shrink-0" />
          </span>
          <p className="text-[15px] text-muted-foreground">{i.body}</p>
        </li>
      ))}
    </ul>
  );
}
