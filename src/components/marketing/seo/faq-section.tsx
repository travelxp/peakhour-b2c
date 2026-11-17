import { Disclosure } from "@/components/marketing/shopify/shopify-disclosure";
import { faqPageLd } from "@/lib/seo/structured-data";
import { JsonLd } from "./json-ld";
import type { FaqItem } from "./content-types";
import { eyebrowCls, h2Cls, wrap } from "./styles";

/**
 * The FAQ, on the /shopify Disclosure (a native <details>): every answer is in the server HTML whether the item is
 * open or not, so a crawler and find-in-page both read all of it. The first item opens so the block is never a
 * wall of closed rows. Two columns from lg, so the heading does not leave a gutter of empty space beside it.
 */
export function FaqSection({ faqs, id = "faq" }: { faqs: FaqItem[]; id?: string }) {
  if (faqs.length === 0) return null;
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20 py-12 sm:py-16">
      <JsonLd data={faqPageLd(faqs)} />
      <div className={`${wrap} grid grid-cols-1 gap-7 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14`}>
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className={eyebrowCls}>FAQ</p>
          <h2 id={`${id}-h`} className={h2Cls}>
            Common questions
          </h2>
        </div>
        <div className="border-t-2 border-foreground">
          {faqs.map((f, i) => (
            <Disclosure key={f.q} title={<h3 className="text-[17px] font-extrabold tracking-tight">{f.q}</h3>} open={i === 0} summaryClassName="py-4 sm:py-5">
              <p className="max-w-[62ch] pb-5 text-muted-foreground">{f.a}</p>
            </Disclosure>
          ))}
        </div>
      </div>
    </section>
  );
}
