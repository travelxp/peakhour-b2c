import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/dashboard/page-shell";
import { ComingSoon } from "@/components/studio/coming-soon";
import { STUDIO_ROUTES } from "@/lib/studio";
import { STUDIO_COPY } from "@/lib/studio-copy";

/**
 * Route shell for the brief (UX spec S3). "Make previews" on an idea lands here with `?idea=`. Until the previews use case is switched
 * on and the brief screen is built, it shows the designed coming-soon card: no quote, no price, nothing charged.
 */
export default function StudioNewPage() {
  const copy = STUDIO_COPY.shells.new;
  return (
    <PageShell width="narrow">
      <PageHeader title={copy.title} description={copy.description} />
      <ComingSoon
        title={STUDIO_COPY.comingSoon.previews.title}
        description={STUDIO_COPY.comingSoon.previews.description}
        actions={
          <Button asChild variant="outline" className="h-11">
            <Link href={STUDIO_ROUTES.home}>{STUDIO_COPY.comingSoon.backToIdeas}</Link>
          </Button>
        }
      />
    </PageShell>
  );
}
