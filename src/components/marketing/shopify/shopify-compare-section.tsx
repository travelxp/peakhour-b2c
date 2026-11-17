import Link from "next/link";
import { DirectoryGrid } from "@/components/marketing/seo/directory-grid";
import { topComparisons } from "@/content/seo/competitors/hub";
import { getPage } from "@/lib/seo/pages";
import { canOpen } from "@/lib/seo/publish";
import { pathFor } from "@/lib/seo/resolve";

/**
 * "Compare Peakhour": the directory link and the top few comparisons. A visitor sees only what they can open: a published
 * comparison on production, and on dev the drafts too, each marked. With none to show it renders nothing (no empty heading).
 */
export function ShopifyCompareSection() {
  const items = topComparisons(3);
  if (items.length === 0) return null;
  const directory = getPage("shopify.compare");
  const showDirectory = canOpen(directory);
  return (
    <section id="compare" aria-labelledby="compare-h" className="scroll-mt-20 border-t py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Compare Peakhour</p>
        <h2 id="compare-h" className="mt-3 text-[2rem] font-extrabold leading-[1.05] tracking-[-0.035em] text-balance sm:text-5xl">
          Weighing it against another app?
        </h2>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          Side-by-side comparisons, each with its sources and the date it was checked.
          {showDirectory && (
            <>
              {" "}
              <Link href={pathFor("shopify.compare")} className="font-semibold text-foreground underline decoration-brand decoration-2 underline-offset-4">
                See every Shopify comparison
              </Link>
              .
            </>
          )}
        </p>
        <div className="mt-8 sm:mt-10">
          <DirectoryGrid items={items} balanced compact />
        </div>
      </div>
    </section>
  );
}
