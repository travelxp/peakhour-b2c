import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/dashboard/page-shell";
import { ComingSoon } from "@/components/studio/coming-soon";
import { STUDIO_ROUTES } from "@/lib/studio";
import { STUDIO_COPY } from "@/lib/studio-copy";

/** Route shell for one creative (UX spec S6 to S13): previews, changes, the final and where it goes. Built by the later lanes. */
export default function StudioCreativePage() {
  const copy = STUDIO_COPY.shells.creative;
  return (
    <PageShell width="narrow">
      <PageHeader title={copy.title} description={copy.description} />
      <ComingSoon
        title={STUDIO_COPY.shells.comingSoonTitle}
        description={STUDIO_COPY.shells.comingSoonDescription}
        actions={
          <Button asChild variant="outline" className="h-11">
            <Link href={STUDIO_ROUTES.home}>{STUDIO_COPY.comingSoon.backToIdeas}</Link>
          </Button>
        }
      />
    </PageShell>
  );
}
