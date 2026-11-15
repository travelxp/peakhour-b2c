import type { HubItem, PlatformItem } from "@/components/marketing/seo/content-types";
import { getCapability } from "@/lib/seo/capabilities";
import { capabilityStatus, claimsHoldOn, findClaim } from "@/lib/seo/status";
import type { Surface } from "@/lib/seo/types";

/*
 * Builders for the module hubs' cards. A card that says something is built FROM an approved claim (its text is the
 * claim, its status the capability record's), so a hub cannot say more than SEO-3's evidence does, and a record that
 * later gets paused or retired fails the build instead of leaving a false "Live" behind. A card for a thing that is not
 * shipped carries its own plain sentence and the "Coming soon" status the record gives it.
 */

function limitationOf(capabilityId: string, surface: Surface, index: number | undefined): string | undefined {
  if (index === undefined) return undefined;
  const impl = getCapability(capabilityId)?.implementations.find((i) => i.surface === surface);
  const text = impl?.limitations?.[index];
  if (!text) throw new Error(`${capabilityId} on ${surface} has no limitation #${index}`);
  return text;
}

/** A card for something that runs: body = the approved claim, status = the record's, limitation = one of the record's. */
export function liveItem(claimId: string, surface: Surface, title: string, limit?: number): HubItem {
  const found = findClaim(claimId);
  if (!found) throw new Error(`No approved claim "${claimId}"`);
  const { claim, capability } = found;
  if (!claimsHoldOn(capability.id, surface)) {
    throw new Error(`Claim "${claimId}" is not satisfied on ${surface}: the capability is ${capabilityStatus(capability.id, surface)}`);
  }
  return {
    title,
    body: claim.text,
    status: capabilityStatus(capability.id, surface),
    surface,
    limitation: limitationOf(capability.id, surface, limit),
  };
}

/** A card for something built but not switched on: our own plain sentence, never a claim. */
export function soonItem(capabilityId: string, surface: Surface, title: string, body: string): HubItem {
  const status = capabilityStatus(capabilityId, surface);
  if (status === "live" || status === "beta") {
    throw new Error(`${capabilityId} on ${surface} is ${status}: write it as a claim with liveItem`);
  }
  return { title, body, status, surface };
}

/** A platform card whose status is read from the record. */
export function platformItem(
  capabilityId: string,
  surface: Surface,
  label: string,
  body: string,
  opts: { href?: string; limit?: number } = {},
): PlatformItem {
  const limitation = limitationOf(capabilityId, surface, opts.limit);
  return {
    surface,
    label,
    status: capabilityStatus(capabilityId, surface),
    body,
    ...(opts.href ? { href: opts.href } : {}),
    ...(limitation ? { limitations: [limitation] } : {}),
  };
}
