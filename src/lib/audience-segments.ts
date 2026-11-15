import type { LucideIcon } from "lucide-react";
import { Building2, Store, ShoppingBag, Users } from "lucide-react";
import type { PillarSlug } from "@/lib/pillars";

/**
 * "Who Peakhour is for" — the four business shapes the platform is built
 * around, kept as data for the same reason the pillars are: it is brand
 * architecture, and the homepage should stay a thin template over it.
 *
 * Each segment answers two questions in that order, because that is the order
 * a visitor asks them: is this MY problem, and then is this product the answer
 * to it. So `problem` is written in their words with no product noun in it at
 * all, and `fit` is the only line allowed to name Peakhour.
 *
 * `pillars` are the two or three that carry that segment. They reference
 * PillarSlug so a renamed pillar breaks the build here rather than shipping a
 * chip pointing at a pillar that no longer exists.
 */
export interface AudienceSegment {
  id: string;
  icon: LucideIcon;
  name: string;
  /** The pain, in their words. No product nouns. */
  problem: string;
  /** Why Peakhour is the answer to exactly that pain. */
  fit: string;
  pillars: PillarSlug[];
}

export const AUDIENCE_SEGMENTS: AudienceSegment[] = [
  {
    id: "d2c",
    icon: ShoppingBag,
    name: "D2C & Ecommerce",
    problem:
      "Shoppers ask at midnight, best-sellers run out without warning, and ad spend quietly drifts the moment nobody is watching it.",
    fit: "Peakhour answers shoppers from your real catalogue on Shopify and WhatsApp, warns you before a product runs out, and has Peakhour Summit review growth decisions before you make them.",
    pillars: ["commerce", "growth", "support"],
  },
  {
    id: "local",
    icon: Store,
    name: "Small & Local Businesses",
    problem:
      "You are the marketing team, the support team, and the person who has not updated the opening hours on Google since last winter.",
    fit: "Peakhour helps you prepare Google Business Profile changes, drafts replies to your Google reviews for you to send, and scores how complete your listing is. Google Business Profile support is in beta.",
    pillars: ["presence", "support", "content"],
  },
  {
    id: "agencies",
    icon: Users,
    name: "Agencies",
    problem:
      "Every client wants more output than the retainer covers, and every new logo means running the same setup from scratch again.",
    fit: "Run several businesses under one account and switch between them, and let AI do the drafting your team reviews instead of writes.",
    pillars: ["content", "growth", "presence"],
  },
  {
    id: "teams",
    icon: Building2,
    name: "Growing Teams & Enterprise",
    problem:
      "Five tools, five logins and five versions of the truth — and the handoffs between them are somebody's whole week.",
    fit: "The modules share one account and one Peaks wallet, and Autopilot acts only inside limits you set, with approvals for new channels and plan changes.",
    pillars: ["commerce", "content", "growth", "support", "presence"],
  },
];
