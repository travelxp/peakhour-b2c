import Link from "next/link";
import { Button } from "@/components/ui/button";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { STUDIO_PATHS, type StudioRefusal } from "@/lib/studio-flow";
import { cn } from "@/lib/utils";

const R = STUDIO_COPY.refusal;

/**
 * A refused or failed charged call, written inside the sheet or card that started it (UX spec 4.2), as an alert. The words come from
 * `studioRefusal`; this draws them and the one next step. A switched-off use case is never drawn here: it is the coming-soon state.
 */
export function RefusalNote({
  refusal,
  onRetry,
  onRequote,
  onNewPlan,
  onSeeProgress,
  makeInstead,
  className,
}: {
  refusal: StudioRefusal;
  onRetry?: () => void;
  /** After a price that changed: ask for the new price. */
  onRequote?: () => void;
  onNewPlan?: () => void;
  onSeeProgress?: () => void;
  /** After a short balance that still covers some: "Make {k} instead". */
  makeInstead?: { label: string; onPress: () => void };
  className?: string;
}) {
  return (
    <div role="alert" data-slot="studio-refusal" data-code={refusal.code} className={cn("space-y-2 rounded-lg border p-3 text-sm", className)}>
      <p>{refusal.text}</p>
      <div className="flex flex-wrap items-center gap-2">
        {refusal.action === "add_peaks" && (
          <Button asChild size="sm" variant="outline" className="h-11 sm:h-8">
            <Link href={STUDIO_PATHS.buyPeaks}>{R.addPeaks}</Link>
          </Button>
        )}
        {refusal.action === "add_peaks" && makeInstead && (
          <Button type="button" size="sm" className="h-11 sm:h-8" onClick={makeInstead.onPress}>
            {makeInstead.label}
          </Button>
        )}
        {refusal.action === "retry" && onRetry && (
          <Button type="button" size="sm" variant="outline" className="h-11 sm:h-8" onClick={onRetry}>
            {R.tryAgain}
          </Button>
        )}
        {refusal.action === "requote" && onRequote && (
          <Button type="button" size="sm" variant="outline" className="h-11 sm:h-8" onClick={onRequote}>
            {STUDIO_COPY.quote.retry}
          </Button>
        )}
        {refusal.action === "new_plan" && onNewPlan && (
          <Button type="button" size="sm" variant="outline" className="h-11 sm:h-8" onClick={onNewPlan}>
            {R.startNewPlan}
          </Button>
        )}
        {refusal.action === "see_progress" && onSeeProgress && (
          <Button type="button" size="sm" variant="outline" className="h-11 sm:h-8" onClick={onSeeProgress}>
            {R.seeProgress}
          </Button>
        )}
      </div>
    </div>
  );
}
