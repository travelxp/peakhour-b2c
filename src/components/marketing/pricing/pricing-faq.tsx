import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { trialFaq } from "@/lib/trial-copy";

const FAQS: { q: string; a: string }[] = [
  {
    q: "What are Peaks?",
    a: "Peaks are your AI credits — one shared wallet across all five modules. Every plan includes a monthly allowance — the cards above show it — and you can top up any time. You'll never hit a surprise paywall mid-task; we warn you before you run low.",
  },
  {
    q: "Do I have to buy every module?",
    a: "There is nothing to assemble. Peakhour Suite is one plan and one price for all five modules — Commerce, Content, Growth, Support and Presence — so you are never picking which parts of your business to leave out. Use the ones you need; the rest are there when you want them.",
  },
  {
    q: "Can I use it inside Shopify or WordPress?",
    a: "Yes. Install the Shopify App or WordPress plugin and the relevant module runs right there. Buy Peakhour Suite inside the Shopify admin and Shopify bills you; buy it on peakhour.ai and you're billed here, whatever you have connected.",
  },
  {
    q: "Which prices will I see?",
    a: "Prices are shown in your local currency, detected from your location, and charged that way at checkout. Contact sales for a custom-currency invoice.",
  },
];

/** Plain-language pricing FAQ. The accordion is a client component; this
 *  wrapper stays data-only so the copy lives in one place. ★The trial entry
 *  is the catalog's (`trialFaq`: Suite's `trialDays`, or how to start when
 *  there is no trial; owner rule 2026-10-06), placed where it always stood. */
export function PricingFaq({ trialDays }: { trialDays: number | null }) {
  const faqs = [...FAQS.slice(0, 3), trialFaq(trialDays), ...FAQS.slice(3)];
  return (
    <Accordion type="single" collapsible className="w-full">
      {faqs.map((faq) => (
        <AccordionItem key={faq.q} value={faq.q}>
          <AccordionTrigger className="text-left text-base font-semibold">
            {faq.q}
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground">
            {faq.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
