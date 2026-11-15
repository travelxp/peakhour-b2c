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
      "Shopify, WhatsApp, LinkedIn, X, Facebook, Instagram, Beehiiv and, in beta, Google Business Profile connect from your dashboard. WordPress and WooCommerce are coming soon.",
    detail:
      "Peakhour works from your real products, policies and past posts, so its drafts start from what you actually sell and write.",
  },
  {
    step: "2",
    title: "Approve the plan",
    description:
      "Peakhour drafts posts, replies and plans. You review and approve; new channels and changes to your subscription always need your approval.",
    detail:
      "Approve, edit or hand back. How much Peakhour does on its own is a limit you set, not a switch.",
  },
  {
    step: "3",
    title: "Let it run, and keep deciding",
    description:
      "Inside the limits you set, Peakhour handles repetitive work and can reverse it. It adjusts your brand voice from what you approve or reject.",
    detail: "Week one it drafts and asks. As you set limits, it asks less about the routine work.",
  },
] as const;
