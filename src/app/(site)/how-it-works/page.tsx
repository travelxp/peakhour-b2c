import { notFound } from "next/navigation";
import { DaylightShell } from "@/components/marketing/seo/shell";
import { FactsCard, Frame, Bullets, ListCard } from "@/components/marketing/seo/frame";
import { Section } from "@/components/marketing/seo/section";
import { StatusChip } from "@/components/marketing/seo/capability-status";
import { cardCls } from "@/components/marketing/seo/styles";
import { withCatalogCta } from "@/components/marketing/seo/hub-route";
import { CONNECTS, HOW_IT_WORKS } from "@/content/pages/how-it-works";
import { CONNECTED_SIGNALS, CONTROL_SPLIT, PLATFORM_FLOW, UNDERSTANDS } from "@/lib/how-peakhour-works";
import { getPage } from "@/lib/seo/pages";
import { pageMeta } from "@/lib/seo/metadata";
import { canOpen } from "@/lib/seo/publish";

export const metadata = pageMeta("how.it.works");

/** /how-it-works: the platform logic. What each module does lives on its own page; this page is the loop around them. */
export default async function HowItWorksPage() {
  const record = getPage("how.it.works");
  if (!canOpen(record)) notFound();
  const page = await withCatalogCta(record);
  return (
    <DaylightShell>
      <Frame
        page={page}
        content={HOW_IT_WORKS}
        art={
          <FactsCard
            title="What connects today"
            facts={CONNECTS.map((c) => ({ label: c.label, value: <StatusChip status={c.status} /> }))}
          />
        }
      >
        <Section id="flow" eyebrow="The loop" title="Six steps, in this order">
          <ol role="list" className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {PLATFORM_FLOW.map((s) => (
              <li key={s.id} className={`${cardCls} flex flex-col gap-2 p-5`}>
                <span aria-hidden className="text-sm font-extrabold tabular-nums text-brand-strong">
                  {s.step}
                </span>
                <h3 className="text-lg font-extrabold tracking-tight">{s.title}</h3>
                <p className="text-[15px] text-muted-foreground">{s.description}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="reads" eyebrow="What it reads" title="Peakhour starts from what you already have." tone="muted">
          <ul role="list" className="grid gap-x-8 gap-y-2 text-[15px] sm:grid-cols-2">
            {UNDERSTANDS.map((u) => (
              <li key={u} className="flex gap-2.5">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
                {u}
              </li>
            ))}
          </ul>
        </Section>

        <Section
          id="examples"
          eyebrow="Examples"
          title="What one part of Peakhour learns, another can use."
          intro="These are examples, not live data. Each action stays yours."
        >
          <ul role="list" className="grid gap-3 md:grid-cols-3 sm:gap-4">
            {CONNECTED_SIGNALS.map((c) => (
              <li key={c.id} className={`${cardCls} flex flex-col gap-2 p-5`}>
                <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                  {c.from} to {c.to}
                </p>
                <p className="font-bold">{c.signal}</p>
                <p className="text-[15px] text-muted-foreground">{c.connection}</p>
                <p className="mt-auto text-[15px]">{c.suggestion}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="control" eyebrow="Who decides" title="What it does for you, and what stays yours." tone="muted">
          <div className="grid gap-4 md:grid-cols-2">
            <ListCard title="Peakhour does" items={[...CONTROL_SPLIT.automatic]} />
            <ListCard title="You decide" items={[...CONTROL_SPLIT.yours]} />
          </div>
          <div className="mt-6 max-w-3xl">
            <Bullets items={["Peakhour Summit reviews growth proposals and only recommends; you approve any change."]} />
          </div>
        </Section>
      </Frame>
    </DaylightShell>
  );
}
