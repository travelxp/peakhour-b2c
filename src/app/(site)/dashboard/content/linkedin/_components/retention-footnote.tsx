import Link from "next/link";

/**
 * Shared retention-disclosure footnote for LinkedIn panels bounded by
 * LinkedIn's Marketing API data-storage rules
 * (https://learn.microsoft.com/en-us/linkedin/marketing/data-storage-requirements).
 *
 * The leading sentence varies per panel (engager scoring vs. boost
 * scoring), so each call site supplies its own copy. The trailing
 * "Why?" link is invariant — both panels point at /help/data-retention,
 * which is the canonical user-facing explainer.
 *
 * Internal navigation uses `next/link` so the click stays on the
 * dashboard shell (no full-page flash on the way to a static page).
 */
export function RetentionFootnote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 border-t pt-2 text-[11px] text-muted-foreground">
      {children}{" "}
      <Link
        href="/help/data-retention"
        className="underline underline-offset-2 hover:text-foreground"
      >
        Why?
      </Link>
    </p>
  );
}
