/**
 * Copy for the "What is this page?" strips. Written for a small-business
 * owner: what the page is for, then what to do first. No product jargon.
 */
export interface PageIntroCopy {
  title: string;
  body: string;
  /** The one thing to do first. */
  next: string;
}

export const PAGE_INTRO_COPY = {
  strategist: {
    title: "What is the Strategist?",
    body: "It suggests what to post next, based on your business, your products and what your customers respond to. Ideas move across the board from idea to published.",
    next: "Press Get ideas to see the first batch.",
  },
  news: {
    title: "What is the News Desk?",
    body: "Short posts about news in your industry, written in your brand's voice. Each one is backed by more than one trusted source, and nothing goes out until you approve it.",
    next: "Open a post and approve the ones you like.",
  },
  ledger: {
    title: "What is the Ledger?",
    body: "A record of everything you published through Peakhour, and how much traffic and how many sales each page brought in. Use it to spot what is worth doing again.",
    next: "Pick a time range at the top to see how you did.",
  },
  "seasonal-events": {
    title: "What are Seasonal Events?",
    body: "Holidays and busy moments, such as Diwali or Black Friday, that your posts are planned around. We added the ones for your country.",
    next: "Add your own, or remove any that do not suit your business.",
  },
  sources: {
    title: "What are Trusted Sources?",
    body: "Websites and feeds you trust. Peakhour reads them to write accurate posts, and shows where each fact came from.",
    next: "Add a site you already follow.",
  },
  "content-autopilot": {
    title: "What is Autopilot?",
    body: "It keeps your posting going without you. It drafts and lines up posts, and brings anything that needs your OK to this page.",
    next: "Check what is waiting for you, and approve it.",
  },
  "commerce-autopilot": {
    title: "What is Autopilot for your store?",
    body: "A helper that suggests changes to your products and listings, and asks before it does anything important. You choose how much it may do on its own.",
    next: "Review what is waiting for your OK.",
  },
  knowledge: {
    title: "What is the Knowledge base?",
    body: "Answers about your business that are not in your product list, such as delivery times and returns. Your assistant uses them to reply to shoppers, and asks you here when it does not know.",
    next: "Answer any open questions, then add the things shoppers ask most.",
  },
  "win-back": {
    title: "What is Win back carts?",
    body: "Sends a WhatsApp reminder to shoppers who left items in their cart, with a link to finish buying. Only people who agreed to hear from you get one.",
    next: "Switch it on and choose how long to wait before the reminder.",
  },
  broadcasts: {
    title: "What are Broadcasts?",
    body: "Send an offer to your customers on WhatsApp in one go, then see who opened it and who bought. Only customers who agreed to hear from you receive it.",
    next: "Choose a message and review it. Nothing sends until you confirm.",
  },
  "growth-rules": {
    title: "What are Growth rules?",
    body: "The limits you set for Peakhour's growth helper: what it may do by itself, what needs your OK, and what it must never do.",
    next: "Read through them once, and change anything you are not comfortable with.",
  },
} as const satisfies Record<string, PageIntroCopy>;

export type PageIntroId = keyof typeof PAGE_INTRO_COPY;
