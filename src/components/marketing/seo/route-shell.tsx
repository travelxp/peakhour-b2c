import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Footer } from "@/components/shared/footer";
import { Header } from "@/components/shared/header";
import { getPage } from "@/lib/seo/pages";
import { isPreviewable, isPublishable } from "@/lib/seo/publish";

/**
 * The route wrapper for a registry page built from the SEO kit: 404 unless the page is publishable (production) or a
 * draft on a non-production deployment (dev, with the draft ribbon), then the Daylight shell around the template.
 * Returns the record so the route renders its template from the same object the metadata came from.
 */
export function renderablePage(pageId: string) {
  const page = getPage(pageId);
  if (!isPublishable(page) && !isPreviewable(page)) notFound();
  return page;
}

export function RouteShell({ children }: { children: ReactNode }) {
  return (
    <div className="theme-daylight flex min-h-screen supports-[min-height:100dvh]:min-h-dvh flex-col">
      <Header />
      {children}
      <Footer />
    </div>
  );
}
