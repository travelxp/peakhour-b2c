import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Footer } from "@/components/shared/footer";
import { Header } from "@/components/shared/header";
import { getPage } from "@/lib/seo/pages";
import { isPreviewable, isPublishable } from "@/lib/seo/publish";
import type { PageRecord } from "@/lib/seo/types";

/**
 * What every /shopify/features route shares. A page is `notFound()` unless it is publishable, or it is a draft or review
 * page on a deployment that is not indexable (dev and previews show it under the "Draft, not published" ribbon).
 */
export function featureRecord(pageId: string): PageRecord {
  const page = getPage(pageId);
  if (!isPublishable(page) && !isPreviewable(page)) notFound();
  return page;
}

/** .theme-daylight: the marketing palette (globals.css), scoped to the page so the Header and Footer follow. */
export function FeatureShell({ children }: { children: ReactNode }) {
  return (
    <div className="theme-daylight flex min-h-screen supports-[min-height:100dvh]:min-h-dvh flex-col">
      <Header />
      {children}
      <Footer />
    </div>
  );
}
