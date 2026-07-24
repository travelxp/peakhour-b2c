import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS: { q: string; a: string }[] = [
  {
    q: "What are Peaks?",
    a: "Peaks are your AI credits — one shared wallet across every pillar. Free tiers include an allowance each month; paid pillars include more. You'll never hit a surprise paywall mid-task; we warn you before you run low.",
  },
  {
    q: "Do I have to buy everything?",
    a: "No. Start free with Presence, then switch on only the pillars you want. Each is billed on its own — turn one off any time.",
  },
  {
    q: "Can I use it inside Shopify or WordPress?",
    a: "Yes. Install the Shopify App or WordPress plugin and the relevant pillar runs right there. Shopify billing goes through Shopify; everywhere else you're billed on peakhour.ai.",
  },
  {
    q: "What's the difference between Free and Paid?",
    a: "Same product, same polish. Paid simply lifts your monthly limits, unlocks more channels, and adds pro features like scheduling, routing and analytics.",
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
