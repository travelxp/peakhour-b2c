import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
    q: "How does the free trial work?",
    a: "Every new business starts on a free Peakhour Suite trial — every module, no card. When it ends, buy Peakhour Suite (monthly or yearly) or Agency (quarterly or yearly) to keep going; until you do, your business has no plan and Peakhour pauses.",
  },
  {
    q: "Which prices will I see?",
    a: "Prices are shown in your local currency, detected from your location, and charged that way at checkout. Contact sales for a custom-currency invoice.",
  },
];

/** Plain-language pricing FAQ. The accordion is a client component; this
 *  wrapper stays data-only so the copy lives in one place. */
export function PricingFaq() {
  return (
    <Accordion type="single" collapsible className="w-full">
      {FAQS.map((faq) => (
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
