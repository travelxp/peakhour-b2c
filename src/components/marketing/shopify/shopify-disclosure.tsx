import { cn } from "@/lib/utils";

/**
 * The /shopify disclosure: a native <details> with a bold summary and a "+"
 * that turns into "×" when open. Native so it works without JavaScript and
 * the closed text stays in the HTML (search, find-in-page, the FAQ's JSON-LD
 * twin). Used by the FAQ (uncontrolled) and the feature tabs (controlled).
 */
export function Disclosure({
  id,
  title,
  open,
  onToggle,
  className,
  summaryClassName,
  children,
}: {
  id?: string;
  title: React.ReactNode;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  className?: string;
  summaryClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <details
      id={id}
      open={open}
      onToggle={onToggle ? (e) => onToggle(e.currentTarget.open) : undefined}
      className={cn("group border-b", className)}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center justify-between gap-4 font-bold [&::-webkit-details-marker]:hidden",
          summaryClassName,
        )}
      >
        {title}
        <span
          aria-hidden
          className="text-xl font-medium leading-none text-muted-foreground transition-transform group-open:rotate-45 motion-reduce:transition-none"
        >
          +
        </span>
      </summary>
      {children}
    </details>
  );
}
