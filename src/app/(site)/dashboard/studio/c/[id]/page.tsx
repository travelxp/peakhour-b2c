import { PageHeader, PageShell } from "@/components/dashboard/page-shell";
import { CreativeWorkspace } from "@/components/studio/creative-workspace";
import { STUDIO_COPY } from "@/lib/studio-copy";

/**
 * One creative (UX spec S6 to S8, S10): previews as they are made, the heart, tap-to-tweak, and finals as they come. One page, driven by the
 * creative's status, polled while anything is being made.
 */
export default async function StudioCreativePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const copy = STUDIO_COPY.shells.creative;
  return (
    <PageShell>
      <PageHeader title={copy.title} description={copy.description} />
      <CreativeWorkspace id={id} />
    </PageShell>
  );
}
