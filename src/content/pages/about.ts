import { PILLARS, PILLAR_ORDER } from "@/lib/pillars";
import { pathFor } from "@/lib/seo/resolve";
import { SITE } from "@/lib/utils";
import type { BaseContent } from "@/components/marketing/seo/content-types";

/*
 * /about. Every company fact below is read from SITE (src/lib/utils.ts), which the privacy policy, terms and cookie
 * policy already print. Nothing is added: no founders, team, funding, offices beyond the two registered addresses,
 * customer counts or press. The page ships as "review" until the owner confirms these facts.
 */
// The market list is the owner's launch list (SEO-11 brief), not a SITE fact: the owner confirms it with the rest before publishing.
export const ABOUT_MARKETS = ["India", "UK", "USA", "Canada", "Australia", "New Zealand"] as const;

export const ABOUT_PILLARS = PILLAR_ORDER.map((slug) => ({
  name: PILLARS[slug].name,
  href: `/${slug}`,
  body: PILLARS[slug].valueProp,
}));

export const ABOUT_COMPANIES = [
  { region: "India", ref: SITE.company.ref, address: SITE.company.address },
  { region: "Outside India", ref: SITE.companyUk.ref, address: SITE.companyUk.address },
] as const;

export const ABOUT_CONTACTS = [
  { label: "General", email: SITE.contactGeneral },
  { label: "Privacy", email: SITE.contactPrivacy },
  { label: "Legal", email: SITE.contactLegal },
  { label: "Grievance Officer (India)", email: SITE.grievanceOfficer.email },
] as const;

export const ABOUT: BaseContent = {
  crumbs: [
    { label: "Home", href: pathFor("home") },
    { label: "About", href: pathFor("about") },
  ],
  eyebrow: "About",
  directAnswer:
    "Peakhour is the AI business platform for growing brands. It answers shoppers, writes and posts content, plans and reviews ads, and prepares your Google listing, and you approve what goes live.",
  secondaryCta: { label: "Contact us", href: pathFor("contact") },
  faqs: [
    { q: "What is Peakhour?", a: "The AI business platform for growing brands. It answers shoppers, writes and posts content, plans and reviews ads, and prepares your Google listing. One login, one plan and one Peaks wallet cover it." },
    { q: "Which company runs Peakhour?", a: `${SITE.name} is a product of ${SITE.company.ref}. Outside India it is marketed and provided by ${SITE.companyUk.ref}. The two companies share one legal name.` },
    { q: "Which markets is Peakhour built for?", a: `${ABOUT_MARKETS.join(", ")}.` },
    { q: "How do I contact Peakhour?", a: `Write to ${SITE.contactGeneral}, or use the contact page.` },
  ],
  related: [
    { label: "How Peakhour works", href: pathFor("how.it.works"), note: "What one part of Peakhour learns, another can use." },
    { label: "Pricing", href: pathFor("pricing"), note: "What Peakhour costs, and how Peaks work." },
    { label: "Contact", href: pathFor("contact"), note: "Email addresses for general, support and privacy questions." },
    { label: "Privacy Policy", href: pathFor("legal.privacy"), note: "How your data is collected, used and protected." },
    { label: "Terms of Service", href: pathFor("legal.terms"), note: "The agreement between you and Peakhour." },
    { label: "Data retention", href: pathFor("trust.data.processing"), note: "How long data from connected platforms is kept." },
  ],
  closing: { headline: "Talk to the team.", body: "Join the waitlist, or write to us with a question first." },
};
