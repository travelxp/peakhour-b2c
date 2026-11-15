import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PAGES } from "@/lib/seo/pages";
import { isPublishable } from "@/lib/seo/publish";
import { pathFor } from "@/lib/seo/resolve";

/**
 * "Shopify features": the directory link, and a link to every published Shopify feature page (family `shopify-feature`), read from the page
 * registry at render. A page appears here the moment it is publishable (SEO-8 adds them) and not before, so this never
 * links to a 404, and with none published it renders nothing at all (no empty heading).
 */
export function ShopifyFeaturesSection() {
  const pages = PAGES.filter((p) => p.family === "shopify-feature" && p.pageId !== "shopify.features" && isPublishable(p));
  if (pages.length === 0) return null;
  return (
    <section id="shopify-features" aria-labelledby="shopify-features-h" className="scroll-mt-20 border-t py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Shopify features</p>
        <h2 id="shopify-features-h" className="mt-3 text-[2rem] font-extrabold leading-[1.05] tracking-[-0.035em] text-balance sm:text-5xl">
          Each feature, in detail.
        </h2>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          One page for each, with its status.{" "}
          <Link href={pathFor("shopify.features")} className="font-semibold text-foreground underline decoration-brand decoration-2 underline-offset-4">
            See all Shopify features
          </Link>
          .
        </p>
        <ul role="list" className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {pages.map((p) => (
            <li key={p.pageId} className="sm:max-lg:[&:last-child:nth-child(odd)]:col-span-2 lg:[&:last-child:nth-child(3n+1)]:col-span-3">
              <Link
                href={pathFor(p.pageId)}
                className="group flex h-full flex-col gap-1.5 rounded-2xl border bg-card p-4 transition-all hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <span className="flex items-center gap-2 font-extrabold tracking-tight">
                  {p.title}
                  <ArrowRight aria-hidden className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </span>
                <span className="text-[15px] text-muted-foreground">{p.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
