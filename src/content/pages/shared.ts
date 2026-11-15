import type { LinkItem, PlatformItem } from "@/components/marketing/seo/content-types";
import { getCapability } from "@/lib/seo/capabilities";
import { pathFor } from "@/lib/seo/resolve";
import type { Capability, CapabilityImplementation, ReleaseStatus, Surface } from "@/lib/seo/types";

/** A link to a registry page, built with pathFor so a wrong id fails at import, not in production. */
export const link = (pageId: string, label: string, note?: string): LinkItem => ({
  label,
  href: pathFor(pageId),
  ...(note ? { note } : {}),
});

export const crumbsFor = (parentId: string, parentLabel: string, label: string, pageId: string) => [
  { label: "Home", href: "/" },
  { label: parentLabel, href: pathFor(parentId) },
  { label, href: pathFor(pageId) },
];

/** The capability's record on a surface. Throws when it has none: a page must not be written for a surface that does not run. */
export function implOf(capabilityId: string, surface: Surface = "web"): { cap: Capability; impl: CapabilityImplementation } {
  const cap = getCapability(capabilityId);
  if (!cap) throw new Error(`Unknown capability "${capabilityId}"`);
  const impl = cap.implementations.find((i) => i.surface === surface);
  if (!impl) throw new Error(`Capability "${capabilityId}" has no ${surface} implementation`);
  return { cap, impl };
}

/**
 * The status and verification date a page shows, taken from the capability itself so a page can never say more than
 * the evidence record does. Limitations are written on the page in merchant words (the records hold some internal
 * notes, such as which catalog says what), and the tests check each page carries at least one.
 */
export function evidenceOf(capabilityId: string, surface: Surface = "web") {
  const { impl } = implOf(capabilityId, surface);
  return { status: impl.status as ReleaseStatus, verifiedAt: impl.verifiedAt };
}

/** A web-only platform card: the surface the capability runs on, with its own status. */
export function webPlatform(capabilityId: string, body: string, label = "Peakhour on the web"): PlatformItem {
  const { impl } = implOf(capabilityId, "web");
  return { surface: "web", label, status: impl.status, body };
}

export const PRICING_NOTE =
  "Included in Peakhour Suite. Anything that uses AI draws on your Peaks allowance; the pricing page shows what each job costs, in Peaks.";

export const PRICING_LINK = (): LinkItem => link("pricing", "Pricing, in Peaks", "What a job costs, and what your plan includes.");

/** The closing band every pre-launch page uses. */
export const closingFor = (subject: string) => ({
  headline: `Want ${subject} in your plan?`,
  body: "Peakhour is opening to launch partners first. Join the waitlist and we will tell you when your place is ready.",
});
