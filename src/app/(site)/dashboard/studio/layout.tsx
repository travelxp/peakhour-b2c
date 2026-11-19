import { MakeFinalBar } from "@/components/studio/make-final";
import { StudioSettingsButton } from "@/components/studio/settings-sheet";
import { StudioStrip } from "@/components/studio/studio-strip";

/**
 * What every Studio screen shares (UX spec 2.2): the running-jobs strip, the settings gear and the Make final bar. The bar shows when
 * something is waiting to be made final, so the count and the price are the same on the ideas, the plan's neighbours, a creative and the
 * Shortlist. The strip shows while Studio is making something, wherever in Studio the merchant is.
 */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto mb-2 w-full max-w-6xl space-y-2 2xl:max-w-7xl">
        <div className="flex justify-end">
          <StudioSettingsButton />
        </div>
        <StudioStrip />
      </div>
      {children}
      <MakeFinalBar />
    </>
  );
}
