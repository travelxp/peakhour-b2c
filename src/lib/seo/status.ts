import { CAPABILITIES, getCapability } from "./capabilities";
import { statusSatisfies } from "./publish";
import type { ReleaseStatus, Surface } from "./types";

/**
 * The status a page may show for a capability on one surface, read from the capability record so a card can never say
 * more than the evidence does. Throws on an unknown capability or a surface it has no record for: a card that names
 * either is a bug to find at build time. (A pillar hub spans surfaces, so it states each card's status on ITS surface
 * rather than leaning on the page-level surface the publish gate uses.)
 */
export function capabilityStatus(capabilityId: string, surface: Surface): ReleaseStatus {
  const cap = getCapability(capabilityId);
  if (!cap) throw new Error(`Unknown capability "${capabilityId}"`);
  const impl = cap.implementations.find((i) => i.surface === surface);
  if (!impl) throw new Error(`Capability "${capabilityId}" has no record on "${surface}"`);
  return impl.status;
}

/** True when every approved claim of the capability is satisfied on that surface (a live claim needs a live build). */
export function claimsHoldOn(capabilityId: string, surface: Surface): boolean {
  const cap = getCapability(capabilityId);
  if (!cap) return false;
  const status = capabilityStatus(capabilityId, surface);
  return cap.approvedClaims.every((c) => statusSatisfies(status, c.requires));
}

/** The approved claim with this id, or undefined. */
export function findClaim(claimId: string) {
  for (const cap of CAPABILITIES) {
    const claim = cap.approvedClaims.find((c) => c.id === claimId);
    if (claim) return { claim, capability: cap };
  }
  return undefined;
}
