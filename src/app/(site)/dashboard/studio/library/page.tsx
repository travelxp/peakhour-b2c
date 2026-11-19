import { PageHeader, PageShell } from "@/components/dashboard/page-shell";
import { Library } from "@/components/studio/library";
import { STUDIO_COPY } from "@/lib/studio-copy";

/** Library (UX spec S14): what Studio made, the product photos it uses and the plans saved for later. Free reads only. */
export default function StudioLibraryPage() {
  const copy = STUDIO_COPY.shells.library;
  return (
    <PageShell>
      <PageHeader title={copy.title} description={copy.description} />
      <Library />
    </PageShell>
  );
}
