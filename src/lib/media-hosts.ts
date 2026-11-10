/**
 * The hosts next/image may fetch from: our own media storage (Cloudflare R2 public bases, one per storage region), nothing else.
 * Never a wildcard: a `**` host turns the optimiser into an open proxy that anyone can point at any image on the web, on our bill.
 *
 * The api serves published files from `R2_PUBLIC_URL_BASE[_<REGION>]` (dev: media-dev.peakhour.ai). Those bases are deployment
 * config, so the extra hosts come from NEXT_PUBLIC_MEDIA_IMAGE_HOSTS (comma-separated bare hostnames), read at build time by
 * next.config.ts and inlined for the browser. A host not listed here is simply rendered as a plain <img> by <MediaImage>.
 */
const DEFAULT_MEDIA_HOSTS = ["media-dev.peakhour.ai"];
const BARE_HOSTNAME = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export function mediaImageHosts(extra: string | undefined = process.env.NEXT_PUBLIC_MEDIA_IMAGE_HOSTS): string[] {
  const listed = (extra ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter((h) => BARE_HOSTNAME.test(h));
  return [...new Set([...DEFAULT_MEDIA_HOSTS, ...listed])];
}

/** True when `src` is an https URL on one of our media hosts, i.e. next/image is allowed to optimise it. */
export function isMediaImageUrl(src: string | null | undefined, hosts: readonly string[] = mediaImageHosts()): boolean {
  if (!src) return false;
  try {
    const u = new URL(src);
    return u.protocol === "https:" && hosts.includes(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}
