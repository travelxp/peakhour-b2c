import Image from "next/image";
import { isMediaImageUrl } from "@/lib/media-hosts";

type Props = {
  src: string;
  alt: string;
  /** Intrinsic size hint for the optimiser; the on-screen size still comes from `className`. */
  width: number;
  height: number;
  className?: string;
  sizes?: string;
};

/**
 * An image from our own media storage. On an allowed media host it goes through next/image (lazy by default); on any other address
 * (a host we do not list, a user-typed URL) it stays a plain <img>, so a host missing from the list never breaks a picture.
 * SVG is served as is: the optimiser does not process it.
 */
export function MediaImage({ src, alt, width, height, className, sizes }: Props) {
  if (!isMediaImageUrl(src)) {
    // eslint-disable-next-line @next/next/no-img-element -- not on a media host we allow next/image to fetch from
    return <img src={src} alt={alt} width={width} height={height} loading="lazy" className={className} />;
  }
  return <Image src={src} alt={alt} width={width} height={height} sizes={sizes} className={className} loading="lazy" unoptimized={/\.svg(\?|$)/i.test(src)} />;
}
