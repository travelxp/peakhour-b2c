/**
 * Starting briefs for the Pages generator.
 *
 * ── ★★WHAT A "TEMPLATE" IS HERE, AND WHAT IT DELIBERATELY IS NOT
 *
 * It is a BRIEF, not a layout. The composer decides the block sequence for
 * itself from what the business actually has to say — hero, pain points,
 * outcomes, feature grid, FAQ, CTA — and no template can or should override
 * that, because a page whose sections were chosen before its content was
 * written is how you get an empty "Testimonials" band on a business with no
 * testimonials.
 *
 * ★So the preview shows the SHAPE and the BRIEF, and says so. A mock of
 * finished copy would be inventing the one thing the product is being asked to
 * produce, and the owner would compare the real page to a fiction we wrote.
 *
 * ── ★★WHY THESE SIX
 *
 * The generator keys a page on an industry axis and an optional persona axis,
 * which is a narrow mechanic wearing a general name. Every template below is a
 * real, common landing-page job expressed through that mechanic — and the
 * `example` on each is what makes it teachable: the fastest way to explain what
 * "Who are these pages for?" wants is to show one filled in.
 *
 * They are ordered by how often an SMB actually needs them, not alphabetically.
 */

export interface PageTemplate {
  id: string;
  name: string;
  /** One line: what this page is for. */
  blurb: string;
  /** Who it is worth doing for — the "should I pick this one" answer. */
  bestFor: string;
  /** The shape the composer typically produces for this brief. */
  outline: string[];
  /** A filled-in brief, used both as the preview and as the prefill. */
  example: { audience: string; who: string; focus: string };
}

export const PAGE_TEMPLATES: readonly PageTemplate[] = [
  {
    id: "industry",
    name: "Industry landing page",
    blurb: "One page per type of customer you serve, in their language.",
    bestFor: "You sell the same thing to several different kinds of business.",
    outline: [
      "Headline naming the industry",
      "The problems that industry actually has",
      "What you do about them",
      "Proof and specifics from your own offering",
      "Questions that industry asks",
      "One clear next step",
    ],
    example: {
      audience: "Cafés & restaurants",
      who: "",
      focus: "Filling quiet weekday tables without discounting the menu",
    },
  },
  {
    id: "service",
    name: "Service page",
    blurb: "One page for one thing you sell, explained properly.",
    bestFor: "You offer several services and your site lumps them into one page.",
    outline: [
      "What the service is, in one line",
      "Who it is for and when to use it",
      "How it works, step by step",
      "What is included",
      "Common questions about scope and price",
      "How to book or enquire",
    ],
    example: {
      audience: "Guided Himalayan treks",
      who: "First-time trekkers",
      focus: "What is included, what fitness is needed, and how the guiding works",
    },
  },
  {
    id: "location",
    name: "Location page",
    blurb: "A page for a place you serve, so people nearby can find you.",
    bestFor: "Customers search for what you do plus where they are.",
    outline: [
      "The place and what you do there",
      "Why local customers choose you",
      "What you offer in that area",
      "Getting there / service area",
      "Local questions",
      "Directions or a booking step",
    ],
    example: {
      audience: "Manali",
      who: "",
      focus: "Trips that start and end in Manali, and what makes the region worth it",
    },
  },
  {
    id: "offer",
    name: "Offer or season",
    blurb: "A page built around one campaign, offer or time of year.",
    bestFor: "You run seasonal pushes and currently send that traffic to your home page.",
    outline: [
      "The offer, stated plainly",
      "What is included and what it costs",
      "Why now — the season or the deadline",
      "What people get out of it",
      "Terms and the obvious questions",
      "Claim it",
    ],
    example: {
      audience: "Winter holidays",
      who: "Families booking early",
      focus: "Early-bird winter packages and what makes booking now worth it",
    },
  },
  {
    id: "why-us",
    name: "Why choose us",
    blurb: "The page that answers “why you and not the other one”.",
    bestFor: "You compete on something real that your site never spells out.",
    outline: [
      "What you actually do differently",
      "The trade-offs, stated honestly",
      "Who you are the right choice for",
      "Who you are not",
      "Questions people ask before switching",
      "Talk to us",
    ],
    example: {
      audience: "Travellers comparing operators",
      who: "",
      focus: "Small groups, local guides, and what that changes about the trip",
    },
  },
  {
    id: "faq",
    name: "Questions & answers",
    blurb: "The things people ask before they buy, answered on one page.",
    bestFor: "Your inbox keeps answering the same five questions.",
    outline: [
      "The short version up front",
      "Questions grouped by topic",
      "Straight answers, no hedging",
      "What to do if the answer is not here",
      "One next step",
    ],
    example: {
      audience: "New customers",
      who: "",
      focus: "Booking, payment, cancellations and what happens if plans change",
    },
  },
] as const;
