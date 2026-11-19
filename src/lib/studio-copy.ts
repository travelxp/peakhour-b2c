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
  /** The page title. The nav label, tab names and description live in nav-copy.ts, the one place the navigation is named. */
  title: "Studio",

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
    },
    dismissFailed: "We couldn't hide that idea. It's back in your list.",
    ideaBack: "Idea is back.",
    undoFailed: "We couldn't bring that idea back. It stays hidden for now.",
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

  /** S14, Library. Tab names are exactly as the spec words them. The empty states for "Made in Studio" live in `shells.library`. */
  library: {
    tabsLabel: "Library sections",
    pagesLabel: "Pages",
    tabs: { made: "Made in Studio", photos: "Product photos", plans: "Saved plans" },
    open: "Open",
    searchLabel: "Search what you've made",
    searchPlaceholder: "Search by headline",
    statusLabel: "Show",
    statuses: { has_final: "Finals", archived: "Archived" },
    chips: { final: "Final", archived: "Archived", plan: "Saved plan" },
    untitled: "Untitled post",
    thumbAlt: (headline: string) => `Preview of ${headline}`,
    noThumb: "No picture yet",
    itemLabel: (headline: string, format: string) => `${headline}, ${format}`,
    pastEnd: "There is nothing on this page. Go back to see your posts.",
    total: (n: number) => (n === 1 ? "1 post" : `${n.toLocaleString()} posts`),
    pageOf: (page: number, pages: number) => `Page ${page} of ${pages}`,
    previous: "Previous page",
    next: "Next page",
    loading: "Loading your Library",
    error: { made: "what you've made", photos: "your product photos", plans: "your saved plans" },
    emptyFiltered: { title: "Nothing matches", description: "Try a different word, or clear the search.", action: "Clear search" },
    plansEmpty: {
      title: "No saved plans",
      description: "When you save a plan while previews aren't available, it waits here.",
      action: "See ideas",
    },
    photosEmpty: {
      title: "No product photos yet",
      description: "Your store photos are added here automatically. You can also upload your own.",
      action: "Upload a photo",
    },
    photoCount: (n: number) => (n === 1 ? "1 photo" : `${n.toLocaleString()} photos`),
    photoAlt: (title: string) => `Photo of ${title}`,
    photoCountAtLeast: (n: number) => `${n.toLocaleString()}+ photos`,
    photoFallbackTitle: "Product",
    noPhotoPreview: "Photo not shown",
    morePhotos: "Show more photos",
    loadingMore: "Loading more",
    moreFailed: "We couldn't load more photos. Try again.",
    addPhoto: "Add photo",
    uploadHref: "/dashboard/drive",
    addFrom: {
      button: "Add from...",
      title: "Add photos from",
      description: "Your store's photos come in on their own. These sources open soon.",
      sources: ["Google Drive", "Dropbox", "Canva", "Instagram posts", "Meta ads"],
      close: "Close",
    },
    imports: {
      heading: "Photos from your stores",
      stores: { shopify: "Shopify", woocommerce: "WooCommerce" },
      running: (store: string) => `Getting photos from your ${store} store...`,
      done: (store: string, when: string | null) => (when ? `Photos from your ${store} store are up to date. Last checked ${when}.` : `Photos from your ${store} store are up to date.`),
      stopped: (store: string) => `Photos from your ${store} store paused`,
      stoppedFallback: "The import paused. It will try again later.",
      progressLabel: (store: string) => `Getting photos from your ${store} store`,
    },
  },

  /** S15, What we've learned about you. The empty state lives in `shells.learned`. */
  learned: {
    loading: "Loading what we've learned",
    error: "what we've learned about you",
    tasteTitle: "Your taste",
    tasteIntro: "What Studio has noticed from the previews you like and skip.",
    stopUsing: "Stop using this",
    stopUsingLabel: (text: string) => `Stop using: ${text}`,
    stopped: "Okay, we've stopped using that.",
    stopFailed: "We couldn't stop using that. It's still in your list.",
    lineGone: "That line was already gone.",
    youWrote: "You wrote this",
    edit: "Edit",
    editLabel: (text: string) => `Edit: ${text}`,
    save: "Save",
    cancel: "Cancel",
    saved: "Saved.",
    saveFailed: "We couldn't save that. Nothing was changed.",
    addTitle: "Add a preference",
    addLabel: "A preference, in your words",
    addPlaceholder: "For example: Keep headlines short",
    addButton: "Add a preference",
    added: "Added. Studio will use it.",
    addFailed: "We couldn't add that. Nothing was changed.",
    counter: (n: number, max: number) => `${n} of ${max} characters`,
    tooLong: (max: number) => `Keep it to ${max} characters or fewer.`,
    rulesTitle: "Rules that always win",
    rulesNote: "Learning never overrides these.",
    changeInBrandKit: "Change in Brand Kit",
    brandKitHref: "/dashboard/drive?tab=brand",
    trendsTitle: "Is it getting better?",
    trendsNeed: (n: number) => `Needs about ${n} posts to show a trend.`,
    trendsPosts: (n: number) => (n === 1 ? "1 approved post so far." : `${n.toLocaleString()} approved posts so far.`),
    trendsReady: (n: number) => `Based on ${n.toLocaleString()} approved posts.`,
    privacyTitle: "Privacy",
    privacyIntro: "This is only about your business.",
    pooledLabel: "Help improve ideas for similar businesses",
    pooledHelp: "Patterns only, never your pictures or text. Off unless you turn it on.",
    pooledOn: "Sharing patterns is on.",
    pooledOff: "Sharing patterns is off.",
    pooledFailed: "We couldn't change that. It stays as it was.",
    export: "Export",
    exportDone: "Your export is ready.",
    exportFailed: "We couldn't make the export. Nothing was changed.",
    exportFile: "studio-learned.json",
    wipe: "Wipe everything we've learned",
    wipeTitle: "Wipe everything we've learned?",
    wipeBody: "This can't be undone. Your Library isn't touched.",
    wipeConfirm: "Wipe it",
    wipeCancel: "Keep it",
    wiped: "Everything we'd learned is gone.",
    wipeFailed: "We couldn't wipe it. Nothing was changed.",
    viewerNote: "Ask an editor to change this.",
  },

  proTools: {
    offTitle: "Pro tools are off",
    offDescription: "This screen is for making many posts at once. Pro tools aren't turned on for you yet.",
    backToIdeas: "Back to ideas",
  },
} as const;
