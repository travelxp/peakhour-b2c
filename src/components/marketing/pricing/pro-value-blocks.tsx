import type { ProValueBlock } from "@/lib/pricing-catalog";

/**
 * "What changes when you go Pro?" — four compact blocks sitting between the
 * cards and the full comparison.
 *
 * The cards answer "what do I get"; the table answers "what exactly differs".
 * Neither answers the question a buyer actually asks at this point, which is
 * what the upgrade CHANGES about their week. Four short blocks, in the pillar's
 * own terms, and nothing longer — anything that needs a paragraph belongs on
 * the pillar page, not on a price list.
 *
 * Rendered only when the pillar has a paid tier to change to (Presence ships
 * none, so its blocks list is empty and this returns nothing).
 */
export function ProValueBlocks({ blocks }: { blocks: ProValueBlock[] }) {
  if (blocks.length === 0) return null;
  return (
    <section className="pt-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-2xl font-extrabold tracking-tight text-pretty">
          What changes when you go Pro?
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {blocks.map((block) => (
            <div key={block.title} className="rounded-2xl border bg-card p-5">
              <div className="flex items-center gap-2.5">
                <span className="h-0.5 w-5 shrink-0 bg-brand-gradient" aria-hidden />
                <h3 className="font-bold tracking-tight">{block.title}</h3>
              </div>
              <p className="mt-2.5 text-sm text-muted-foreground">{block.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
