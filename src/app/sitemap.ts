import type { MetadataRoute } from "next";
import { SITE } from "@/lib/utils";
import { PILLAR_ORDER } from "@/lib/pillars";

/**
 * Marketing sitemap. Lists only public, indexable marketing routes — not the
 * gated app (dashboard/onboarding/auth/cms), which must stay out of the index.
 * Absolute URLs are built from SITE.url (env-overridable).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE.url.replace(/\/$/, "");

  const staticPaths: {
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  }[] = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" },
    { path: "/pricing", priority: 0.9, changeFrequency: "weekly" },
    { path: "/peaks", priority: 0.7, changeFrequency: "monthly" },
    { path: "/how-it-works", priority: 0.7, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
    { path: "/privacy-policy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
    { path: "/cookie-policy", priority: 0.3, changeFrequency: "yearly" },
  ];

  const pillarPaths = PILLAR_ORDER.map((slug) => ({
    path: `/${slug}`,
    priority: 0.8,
    changeFrequency: "weekly" as const,
  }));

  return [...staticPaths, ...pillarPaths].map(
    ({ path, priority, changeFrequency }) => ({
      url: `${base}${path}`,
      changeFrequency,
      priority,
    }),
  );
}
