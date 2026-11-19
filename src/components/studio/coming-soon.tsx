import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STUDIO_COPY } from "@/lib/studio-copy";
import { cn } from "@/lib/utils";

/**
 * The designed "coming soon" (UX spec 4.3): a card, never an error and never a price. Shown where a use case is not switched on yet.
 * `actions` carries the page's own buttons; nothing here asks for a quote.
 */
export function ComingSoon({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      data-slot="studio-coming-soon"
      className={cn("flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center", className)}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Sparkles aria-hidden="true" className="size-6 text-muted-foreground" />
      </div>
      <Badge variant="secondary">{STUDIO_COPY.comingSoon.chip}</Badge>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {actions && <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </section>
  );
}
