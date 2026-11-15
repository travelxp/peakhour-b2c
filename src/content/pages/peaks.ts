import type { BaseContent } from "@/components/marketing/seo/content-types";
import { PEAKS_REFUND_SENTENCE } from "@/lib/peaks-refund-terms";
import { pathFor } from "@/lib/seo/resolve";

/** /peaks. Peaks are the AI credits; the copy states how they work, never what a job costs in money. */
export const PEAKS: BaseContent = {
  crumbs: [
    { label: "Home", href: pathFor("home") },
    { label: "Peaks", href: pathFor("peaks") },
  ],
  eyebrow: "Peaks",
  directAnswer:
    "Peaks are the AI credits behind every Peakhour feature: they pay for the drafting, answering and analysing the AI does. Every plan includes a monthly allowance, and you can top up any time. Peaks you buy never expire.",
  faqs: [
    {
      q: "What do Peaks pay for?",
      a: "They are spent when the AI actually runs: drafting, generating and analysing. Writing and editing yourself costs nothing.",
    },
    {
      q: "Do Peaks expire?",
      a: "The monthly allowance in your plan renews every month. Peaks you buy as a top-up never expire and work across every Peakhour product.",
    },
    {
      q: "Do I need a plan to use Peaks?",
      a: "Yes. Peaks need an active paid Peakhour plan, which comes with its own monthly allowance.",
    },
    {
      q: "Can I get a refund on Peaks?",
      a: PEAKS_REFUND_SENTENCE,
    },
  ],
  related: [
    { label: "Peakhour pricing", href: pathFor("pricing"), note: "The plan, its monthly Peaks allowance and what it includes." },
    { label: "Agency and Enterprise plans", href: pathFor("pricing.teams"), note: "Volume Peaks for teams running many businesses." },
    { label: "How Peakhour works", href: pathFor("how.it.works"), note: "Where the AI runs, and where you approve." },
  ],
  closing: {
    headline: "Start with a plan. Peaks come with it.",
    body: "You need an active paid Peakhour plan to use Peaks. Pick a plan to get your allowance, then top up any time.",
  },
};
