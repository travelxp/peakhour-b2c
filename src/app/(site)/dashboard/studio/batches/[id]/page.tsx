import { ProToolsGate } from "@/components/studio/pro-tools-gate";
import { ComingSoon } from "@/components/studio/coming-soon";
import { PageHeader, PageShell } from "@/components/dashboard/page-shell";
import { STUDIO_COPY } from "@/lib/studio-copy";

/**
 * Route shell for the grid approval (UX spec S16, Pro tools). A direct visit with Pro tools off shows the "Pro tools are off" empty state,
 * never a 404.
 */
export default function StudioBatchPage() {
  const copy = STUDIO_COPY.shells.batch;
  return (
    <PageShell>
      <PageHeader title={copy.title} description={copy.description} />
      <ProToolsGate>
        <ComingSoon title={STUDIO_COPY.shells.comingSoonTitle} description={STUDIO_COPY.shells.comingSoonDescription} />
      </ProToolsGate>
    </PageShell>
  );
}
