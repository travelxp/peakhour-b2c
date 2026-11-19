import { ProToolsGate } from "@/components/studio/pro-tools-gate";
import { BatchScreen } from "@/components/studio/batch-grid";
import { PageHeader, PageShell } from "@/components/dashboard/page-shell";
import { STUDIO_COPY } from "@/lib/studio-copy";

/**
 * The grid for approving many at once (UX spec S16, Pro tools). A direct visit with Pro tools off shows the "Pro tools are off" empty state, never a 404.
 */
export default async function StudioBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const copy = STUDIO_COPY.shells.batch;
  return (
    <PageShell>
      <PageHeader title={copy.title} description={copy.description} />
      <ProToolsGate>
        <BatchScreen id={id} />
      </ProToolsGate>
    </PageShell>
  );
}
