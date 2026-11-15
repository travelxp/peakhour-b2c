import type { StepItem } from "./content-types";

/**
 * Numbered steps in the visual language of the home page's StepTimeline (a brand-gradient node on a connecting
 * line), without its scroll-linked animation: this is a server component with no client JS, and the line is
 * simply drawn. Vertical on a phone, a row from lg when there are three or four steps.
 */
export function WorkflowSteps({ steps }: { steps: StepItem[] }) {
  const row = steps.length >= 3 && steps.length <= 4;
  return (
    // The explicit role is load-bearing: preflight's list-style:none drops the list role in WebKit, and the numerals
    // below are aria-hidden, so without it nothing tells a screen reader the order.
    <ol
      role="list"
      className={row ? "relative grid gap-7 lg:grid-flow-col lg:auto-cols-fr lg:gap-x-0" : "relative grid gap-7"}
    >
      {steps.map((s, i) => (
        <li
          key={s.title}
          className={
            row
              ? "relative grid grid-cols-[3.5rem_1fr] items-start gap-4 lg:flex lg:flex-col lg:items-center lg:gap-4 lg:px-4 lg:text-center"
              : "relative grid grid-cols-[3.5rem_1fr] items-start gap-4"
          }
        >
          {/* The connecting line: down the node column on a phone, across the row from lg. */}
          {i < steps.length - 1 && (
            <span
              aria-hidden
              className={
                row
                  ? "absolute left-7 top-14 -bottom-7 w-px bg-brand/25 lg:left-1/2 lg:top-7 lg:bottom-auto lg:h-px lg:w-full"
                  : "absolute left-7 top-14 -bottom-7 w-px bg-brand/25"
              }
            />
          )}
          <span
            aria-hidden
            className="relative z-10 flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-gradient font-serif text-xl italic text-brand-contrast shadow-lg shadow-brand/20"
          >
            {i + 1}
          </span>
          <div className="min-w-0 pt-1 lg:pt-0">
            <h3 className="text-lg font-bold tracking-tight">{s.title}</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground lg:mx-auto lg:max-w-xs">{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
