/**
 * Content for the standalone "How Peakhour works" page (/how-it-works).
 *
 * This page explains the PLATFORM LOGIC (connect, understand, connect the dots, find what matters, act, and hand the
 * founder less to manage). It is deliberately NOT a feature page: what each module does lives on /commerce, /content,
 * /growth, /support and /presence, with its status. If you are tempted to add a capability bullet, it belongs there.
 *
 * Every sentence here is held to what src/lib/seo/capabilities.ts says is built (SEO-7). The examples are labelled as
 * examples on the page, and each one is something a connected module can show today, never a promise of a result.
 */

/** The six-step spine of the page, in an order that is load-bearing: understanding precedes connecting, and so on. */
export const PLATFORM_FLOW = [
  {
    id: "connect",
    step: "01",
    title: "Connect your business",
    description:
      "Connect the tools you already run on from your dashboard: your Shopify store, WhatsApp, LinkedIn, X, Facebook, Instagram, Beehiiv and, in beta, your Google Business Profile. WordPress and WooCommerce are coming soon.",
  },
  {
    id: "understand",
    step: "02",
    title: "Peakhour reads what is there",
    description:
      "It works from your real catalogue and policies, and learns how your brand writes from the posts you have already published, instead of asking you to describe either.",
  },
  {
    id: "connect-dots",
    step: "03",
    title: "It joins what it finds",
    description:
      "What it learns in one place is used in another. Your catalogue answers shoppers, and the questions it could not answer are shown back to you.",
  },
  {
    id: "find",
    step: "04",
    title: "It puts the decisions in front of you",
    description:
      "You can ask Peakhour questions about your own data. Anything it would change comes to you as a card to approve, and Peakhour Summit reviews your growth proposals before you decide.",
  },
  {
    id: "act",
    step: "05",
    title: "You approve, or set the limits",
    description:
      "Some work arrives as a proposal to approve. Inside limits you set, Autopilot handles the repetitive work and can reverse it. New channels and changes to your subscription always need your approval.",
  },
  {
    id: "less",
    step: "06",
    title: "You have less to manage",
    description: "Fewer tabs open, fewer things to remember to check. The work still happens, and you still decide.",
  },
] as const;

/** What Peakhour reads once the connections are in place, limited to what is built. */
export const UNDERSTANDS = [
  "Your brand voice, from your own posts",
  "Your products and policies",
  "Your stock health",
  "What shoppers ask your assistant",
  "How your social posts perform",
  "How your Meta and X ads perform",
  "Your Google reviews and listing (beta)",
  "Your business information",
] as const;

/**
 * Three examples of one module's result changing what you do in another. They are EXAMPLES, labelled so on the page:
 * each is a thing the connected modules can show today, with the action left to you.
 */
export const CONNECTED_SIGNALS = [
  {
    id: "repeat-question",
    from: "Support",
    to: "Content",
    signal: "Several shoppers ask your assistant the same thing and it cannot answer.",
    connection: "Conversation insights shows the question, how often it comes up and whether it is rising.",
    suggestion: "You decide whether to write the answer once, properly, as a post or a product description.",
  },
  {
    id: "unsold-demand",
    from: "Support",
    to: "Commerce",
    signal: "Shoppers keep asking for a product you do not sell.",
    connection: "The same insights list shows products people wanted that are not in your catalogue.",
    suggestion: "You decide whether it is worth stocking.",
  },
  {
    id: "strong-post",
    from: "Content",
    to: "Growth",
    signal: "One LinkedIn post does far better than the rest.",
    connection: "Peakhour tracks engagement on your posts.",
    suggestion: "You can boost that post into an ad campaign, and Peakhour Summit can review the plan first.",
  },
] as const;

/** What is safe to hand over versus what stays the founder's call. */
export const CONTROL_SPLIT = {
  automatic: [
    "Drafting the post, the reply, the description",
    "Reading your catalogue and past posts so drafts start from what is true",
    "Repetitive work inside the limits you set, which you can reverse",
  ],
  yours: [
    "What you sell, and at what price",
    "What goes out in your name",
    "Where the budget goes",
    "How much you hand over, and when",
  ],
} as const;
