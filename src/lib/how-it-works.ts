/**
 * The three onboarding steps — single source of truth shared by the homepage
 * "How it works" section and the standalone /how-it-works page. The homepage
 * uses step/title/description; the standalone page additionally renders
 * `detail`. Keeping one array prevents the two surfaces from drifting.
 */
export const HOW_IT_WORKS_STEPS = [
  {
    step: "1",
    title: "Connect what you have",
    description:
      "Shopify, WordPress, WooCommerce, WhatsApp, LinkedIn, Google — one click each. Peakhour reads your real catalog and content, never guesses from your name.",
    detail:
      "Everything the AI does is grounded in your actual products, prices, and past content — so it's right from day one, not generic.",
  },
  {
    step: "2",
    title: "Approve the plan",
    description:
      "AI drafts your brand voice, content calendar, and assistant behavior. You review and approve — nothing ships without your say-so, until you say otherwise.",
    detail:
      "You stay in control. Approve, edit, or hand back. Autonomy is a dial you turn up as trust grows, not a switch you flip on day one.",
  },
  {
    step: "3",
    title: "Let it run, watch it learn",
    description:
      "Pillars work daily and report in plain language. Every approval teaches the AI your taste; autonomy grows as trust does.",
    detail:
      "Week one it drafts and asks. By month three it knows your bestsellers, your voice, and your customers' questions — and needs you less.",
  },
] as const;
