import { Suspense } from "react";
import { PageHeader, PageShell } from "@/components/dashboard/page-shell";
import { BriefScreen } from "@/components/studio/brief-screen";
import { Skeleton } from "@/components/ui/skeleton";
import { STUDIO_COPY } from "@/lib/studio-copy";

/**
 * The plan (UX spec S3). "Make previews" on an idea lands here with `?idea=`; a catalog row with `?products=`; a saved plan with `?c=`.
 * While previews are not available the screen shows the designed coming-soon card: no quote, no price, nothing charged.
 */
export default function StudioNewPage() {
  const copy = STUDIO_COPY.shells.new;
  return (
    <PageShell width="narrow">
      <PageHeader title={copy.title} description={copy.description} />
      <Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
        <BriefScreen />
      </Suspense>
    </PageShell>
  );
}
