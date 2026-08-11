/**
 * Content for the standalone "See how Peakhour works" page (/how-it-works).
 *
 * This page explains the PLATFORM LOGIC — connect, understand, connect the
 * dots, find what matters, act, and hand the founder less to manage. It is
 * deliberately NOT a feature page: everything a single pillar does lives on
 * /commerce, /content, /growth, /support and /presence, and repeating it here
 * would turn the one page that explains the whole idea into a sixth feature
 * list. If you're tempted to add a capability bullet, it belongs on a pillar
 * page instead.
 *
 * Copy lives here rather than inline in the page for the same reason
 * HOW_IT_WORKS_STEPS and PILLAR_CONSOLE_ROWS do: it is brand messaging that
 * gets edited far more often than the layout around it, and a data file is a
 * reviewable diff.
 *
 * ⚠️ Every example below is ILLUSTRATIVE — a plausible day, not a claim about
 * live data or a shipped screen. Keep them generic (no named customer, no
 * specific figure we'd have to stand behind) so nothing here becomes a promise
 * the product has to keep.
 */

/**
 * The six-step spine of the page. This is the whole argument in order, and the
 * order is load-bearing: understanding has to precede connecting, connecting
 * has to precede finding, and the payoff step ("less to manage") only lands
 * once the five before it have been earned.
 */
export const PLATFORM_FLOW = [
  {
    id: "connect",
    step: "01",
    title: "Connect your business",
    description:
      "Sign in to the tools you already run on — your store, your site, WhatsApp, your social accounts, your ad accounts, your Google listing. One click each, no data exports, no setup project.",
  },
  {
    id: "understand",
    step: "02",
    title: "Peakhour understands it",
    description:
      "It reads what is actually there rather than asking you to describe it — how you write, who buys from you, what you sell, what is moving, what people ask.",
  },
  {
    id: "connect-dots",
    step: "03",
    title: "Peakhour connects the dots",
    description:
      "Everything lands in one place, so what happens in one part of your business can inform another. Stock knows what your ads are doing. Content knows what your customers keep asking.",
  },
  {
    id: "find",
    step: "04",
    title: "Peakhour finds what matters",
    description:
      "Out of thousands of small signals, only a handful change what you should do this week. Peakhour is looking for those, all the time, so you don't have to go hunting.",
  },
  {
    id: "act",
    step: "05",
    title: "Peakhour suggests or takes action",
    description:
      "Some things come to you as a recommendation you approve in one tap. The repetitive ones it simply handles, once you've told it that it can.",
  },
  {
    id: "less",
    step: "06",
    title: "You have less to manage",
    description:
      "Fewer tabs open, fewer dashboards to reconcile, fewer things you have to remember to check. The work still happens.",
  },
] as const;

/**
 * What Peakhour picks up on its own once the connections are in place. These
 * are the eleven things the founder would otherwise have to explain to a new
 * hire — which is exactly the point of the section that renders them.
 */
export const UNDERSTANDS = [
  "Your brand voice",
  "Your writing style",
  "Your audience",
  "Your products",
  "Your stock health",
  "Your sales",
  "Your customer conversations",
  "Your content performance",
  "Your ad performance",
  "Your reviews",
  "Your business information",
] as const;

/**
 * The heart of the page: one thing observed in a corner of the business
 * changing what you should do somewhere else. `signal` is what happened,
 * `connection` is the link only a shared intelligence layer can make, and
 * `suggestion` is what lands in front of the founder.
 *
 * `from` / `to` name the two parts of the business being joined — they're what
 * makes the row read as a CONNECTION rather than a single tool being clever.
 */
export const CONNECTED_SIGNALS = [
  {
    id: "repeat-question",
    from: "Support",
    to: "Content",
    signal: "Customers keep asking the same question about a product.",
    connection: "Peakhour notices the pattern across every conversation, not just the last one.",
    suggestion: "Publish a piece that answers it — once, properly, everywhere.",
  },
  {
    id: "slow-mover",
    from: "Commerce",
    to: "Growth",
    signal: "A product is moving more slowly than it should.",
    connection: "Peakhour puts your stock position next to what your marketing is actually doing.",
    suggestion: "Give it a push before the stock ages.",
  },
  {
    id: "breakout-reel",
    from: "Content",
    to: "Growth",
    signal: "One Reel is performing far better than the rest.",
    connection: "Peakhour spots the outlier while it's still fresh.",
    suggestion: "Put money behind it and use it as ad creative.",
  },
  {
    id: "demand-vs-stock",
    from: "Support",
    to: "Commerce",
    signal: "Customers keep asking for something you're low on.",
    connection: "Peakhour compares what people are asking for with what you actually have.",
    suggestion: "Look at reordering before you're out.",
  },
  {
    id: "review-theme",
    from: "Presence",
    to: "the business",
    signal: "Reviews keep mentioning the same issue.",
    connection: "Peakhour reads them as a theme rather than as one-star events.",
    suggestion: "Here's the thing worth fixing, in your own words.",
  },
] as const;

/**
 * The "brought to you" list — the same idea as CONNECTED_SIGNALS, but framed
 * as the founder's actual inbox: a plain-language observation and the single
 * next action attached to it. Rendered as a product panel, so keep the
 * observations short enough to sit on one line at tablet width.
 */
export const NEXT_ACTIONS = [
  { pillar: "Support", observation: "Customers keep asking about this product.", action: "Create content" },
  { pillar: "Commerce", observation: "Stock is moving slowly.", action: "Promote it" },
  { pillar: "Growth", observation: "This creative is outperforming.", action: "Use it in your campaign" },
  { pillar: "Presence", observation: "Your business information needs updating.", action: "Fix it" },
] as const;

/**
 * The tools a founder currently opens one at a time to work out what needs
 * attention. Names only — this list exists to be recognised, and the section
 * that renders it deliberately makes no claim about which are connected today
 * (the homepage integrations grid is catalog-driven and does that honestly).
 *
 * ⚠️ SIX entries, and the count is load-bearing: the section heading above it
 * reads "six dashboards" and the caption beneath it reads "Six tabs". Adding a
 * seventh name here silently makes both lines wrong. Change the list and the
 * copy together, or don't change either.
 */
export const SCATTERED_TOOLS = [
  "Store",
  "WhatsApp",
  "Instagram",
  "Ads manager",
  "Google",
  "Reviews",
] as const;

/**
 * What is safe to hand over versus what stays the founder's call. The split is
 * the promise of the page's control section: automation earns its way in on
 * the repetitive work, and never quietly takes the decisions.
 */
export const CONTROL_SPLIT = {
  automatic: [
    "Watching every channel for what changed",
    "Drafting the post, the reply, the description",
    "Keeping your listing and catalog in step",
    "Chasing the routine follow-up",
  ],
  yours: [
    "What you sell, and at what price",
    "What goes out in your name",
    "Where the budget goes",
    "How much you hand over, and when",
  ],
} as const;

/** The emotional close. Three lines of relief, then the one line of payoff. */
export const RELIEF_LINES = [
  "Less keeping track.",
  "Less switching between tools.",
  "Less mental load.",
] as const;
