type Props = {
  src: string;
  alt: string;
  /** Intrinsic size, so the browser reserves the box before the file arrives (no layout shift). */
  width: number;
  height: number;
  className?: string;
  /** Accepted for call-site compatibility; a plain <img> has no optimiser to hint. */
  sizes?: string;
};

/**
 * A merchant's media file (Drive, brand kit, post attachments), as a plain lazy <img>.
 *
 * NOT next/image, on purpose (decided 2026-11-10, reversing the first cut in #729):
 * - Drive serves published files from FOUR regional domains (R2_PUBLIC_URL_BASE_<APAC|WEUR|ENAM|OC> in peakhour-api), set per
 *   environment, so this app cannot list them; and private files arrive as presigned GET URLs that expire.
 * - The optimiser caches by URL: every newly signed link is a fresh, billed transformation, and an expired link is a broken one.
 * - Merchant uploads are unbounded, so the cost scales with usage while the gain (thumbnails in a file manager) is small. If
 *   resizing is wanted, it belongs at the source (Cloudflare image resizing on the same domains), not in a Vercel round trip.
 */
export function MediaImage({ src, alt, width, height, className }: Props) {
  // eslint-disable-next-line @next/next/no-img-element -- merchant media stays off the optimiser; see the note above
  return <img src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async" className={className} />;
}
