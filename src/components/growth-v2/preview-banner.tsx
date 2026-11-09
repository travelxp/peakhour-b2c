import { FlaskConical } from "lucide-react";

/**
 * The banner every v2 screen wears while its route still answers 501 NOT_BUILT.
 *
 * ★A FIXTURE MUST NEVER PASS FOR THE MERCHANT'S NUMBERS. Everything below the
 * banner is the prototype's sample business; the words say so, and name the plan
 * row that will replace it.
 */
export function PreviewBanner({ row }: { row?: string }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-lg border border-dashed border-chart-2/40 bg-chart-2/5 px-3 py-2 text-sm"
    >
      <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0 text-chart-2" />
      <p className="min-w-0">
        <span className="font-medium">Preview data.</span>{" "}
        <span className="text-muted-foreground">
          This is a sample business, not yours. Your own numbers appear here once{" "}
          {row ? `plan row ${row}` : "this screen"} is live.
        </span>
      </p>
    </div>
  );
}
