/**
 * ★THE ONE PLACE STUDIO'S MERCHANT WORDS LIVE (Creative Studio UX spec U14, section 9).
 * Every sentence a merchant reads on a Studio screen is written here and nowhere else: pages and components import it, they do not spell
 * a sentence out. `studio-copy.test.ts` fails the build when a string here (or a Studio component) carries a currency symbol or one of the
 * Creative Studio Bible's avoid-words. Prices are Peaks only: the figure comes from the quote, never from this file.
 *
 * Same pattern as nav-copy.ts. Add a screen's words here when the lane that builds the screen lands.
 */

import type { PostFormat, PostIdeaKind } from "@/lib/api/creative";

export const STUDIO_COPY = {
  title: "Studio",
  pillarDescription: "Make posts and ads from your real products, and approve them in one tap.",
  tabs: {
    ideas: "Ideas",
    shortlist: "Shortlist",
    library: "Library",
    learned: "What we've learned",
  },

  /** S1, Studio home. */
  ideas: {
    intro: "Post ideas for you. Each one says why.",
    sectionTitle: "Ideas for you",
    footerNote: "Ideas are free. You only use Peaks when you ask for previews.",
    makePreviews: "Make previews",
    notNow: "Not now",
    startFromScratch: "Start from scratch",
    previewsOpenSoon: "Making previews opens soon. Your ideas are ready now.",
    goodUntil: (date: string) => `Good until ${date}`,
    ideaHidden: "Idea hidden.",
    undo: "Undo",
    loading: "Loading your ideas",
    empty: {
      title: "No ideas right now",
      description: "We look at your stock, reviews, new products and festivals. Check back soon, or start your own.",
    },
    notConnected: {
      title: "Connect your store to get ideas",
      description: "Ideas come from your products and sales.",
      action: "Connect store",
    },
    error: {
      what: "your ideas",
      title: "We couldn't load your ideas.",
      retry: "Try again",
    },
    dismissFailed: "We couldn't hide that idea. It's back in your list.",
    /** Cooling period over, the idea may come back. */
    backAfter: (date: string) => `Okay, we won't suggest this again until ${date}.`,
    /** A festival idea stays away until the festival has passed. */
    backAfterFestival: (festival: string) => `Okay, we won't suggest this again until after ${festival}.`,
  },

  kinds: {
    festival: "Festival",
    low_stock: "Low stock",
    overstock: "Overstock",
    high_margin: "High margin",
    new_reviews: "New reviews",
    new_products: "New product",
    sold_before: "Sold before",
  } satisfies Record<PostIdeaKind, string>,

  formats: {
    feed: "Feed",
    story: "Story",
    reel: "Reel",
  } satisfies Record<PostFormat, string>,

  /** Section 4.3: a use case that is not switched on is a designed "coming soon", never an error and never a price. */
  comingSoon: {
    previews: {
      title: "Previews are coming soon",
      description:
        "We're getting the picture maker ready. Your ideas, Library and settings work now. We'll tell you the day previews open.",
    },
    chip: "Coming soon",
    backToIdeas: "Back to ideas",
    savePlan: "Save this plan",
  },

  /** Route shells: screens a later lane fills in. Each says what it will do and what works now. */
  shells: {
    new: {
      title: "Your plan",
      description: "See the plan for a post and change it in one screen, then ask for previews.",
    },
    creative: {
      title: "Your post",
      description: "Previews, changes, the final and where it goes, in one place.",
    },
    shortlist: {
      title: "Shortlist",
      description: "Everything you've hearted, waiting to be made final.",
      emptyTitle: "Nothing shortlisted yet",
      emptyDescription: "Tap the heart on a preview you like. It waits here until you make it final.",
      emptyAction: "See ideas",
    },
    library: {
      title: "Library",
      description: "What you've made, and the product photos Studio uses.",
      emptyTitle: "Nothing made yet",
      emptyDescription: "Finals you make show up here, ready to post again.",
      emptyAction: "See ideas",
    },
    learned: {
      title: "What we've learned about you",
      description: "What Studio has noticed about your taste. You can change or delete anything.",
      emptyTitle: "Nothing learned yet",
      emptyDescription:
        "After you shortlist or skip a few previews, we'll note what you like here. You can change or delete anything.",
      emptyAction: "See ideas",
    },
    batch: {
      title: "Approve many at once",
      description: "Look through many previews in one grid and approve them together.",
    },
    approvalLink: {
      title: "Does this look right?",
      description: "Approving a picture by link opens soon.",
    },
    comingSoonTitle: "This part of Studio is coming soon",
    comingSoonDescription: "We're building it now. Your ideas work today.",
  },

  proTools: {
    offTitle: "Pro tools are off",
    offDescription: "Turn on Pro tools in Studio settings to use this screen.",
    backToIdeas: "Back to ideas",
  },
} as const;
