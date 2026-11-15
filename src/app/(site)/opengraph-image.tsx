import { SITE } from "@/lib/utils";
import { OG_SIZE, ogCard } from "@/lib/seo/og-card";

// The site-wide share image, in Daylight: the official lockup, the site tagline, coral as the accent. Registry pages
// carry their own (app/og/[file]/route.tsx), with their H1 and family; every other page falls back to this one.
export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return ogCard({ eyebrow: "Commerce · Content · Growth · Support · Presence", title: SITE.tagline });
}
