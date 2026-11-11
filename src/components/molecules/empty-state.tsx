import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void } | { label: string; href: string };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-100 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center",
        className
      )}
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon aria-hidden="true" className="size-6 text-muted-foreground" />
      </div>
      {/* h2, not h3: an empty state is usually the only thing under the page's h1, and h1 -> h3 skips a level (axe
          heading-order on /dashboard/commerce, 2026-11-11). Inside a section an h2 is still in order: headings may go up. */}
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {action && "onClick" in action && (
        <Button onClick={action.onClick} className="mt-6">
          {action.label}
        </Button>
      )}
      {action && "href" in action && (
        <Button asChild className="mt-6">
          <a href={action.href}>{action.label}</a>
        </Button>
      )}
    </div>
  );
}
