import { MakeFinalBar } from "@/components/studio/make-final";
import { StudioToolbar } from "@/components/studio/studio-toolbar";

/**
 * What every Studio screen shares (UX spec 2.2): the settings gear and running-jobs strip, and the Make final bar. The bar shows when
 * something is waiting to be made final, so the count and the price are the same on the ideas, the plan's neighbours, a creative and the
 * Shortlist. The strip shows while Studio is making something, wherever in Studio the merchant is.
 */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StudioToolbar />
      {children}
      <MakeFinalBar />
    </>
  );
}
