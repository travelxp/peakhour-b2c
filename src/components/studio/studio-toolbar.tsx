"use client";

import { StudioSettingsButton } from "@/components/studio/settings-sheet";
import { StudioStrip } from "@/components/studio/studio-strip";
import { useStudioAbilities } from "@/hooks/use-studio-flow";

/**
 * The row above every Studio screen: the settings gear (editors and above; a viewer cannot change settings, so no row is left for them) and the
 * running-jobs strip (nothing while nothing is running).
 */
export function StudioToolbar() {
  const { canMake } = useStudioAbilities();
  return (
    <>
      {canMake && (
        <div className="mx-auto mb-2 flex w-full max-w-6xl justify-end 2xl:max-w-7xl">
          <StudioSettingsButton />
        </div>
      )}
      <StudioStrip />
    </>
  );
}
