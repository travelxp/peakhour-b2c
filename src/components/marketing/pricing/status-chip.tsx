/**
 * Maps a product's raw catalog status to a customer-facing state chip. Encodes
 * availability in form as well as words — a live pillar gets a green pulse, a
 * coming-soon one reads calm and muted — so the hub scans at a glance.
 */
export function StatusChip({ status }: { status?: string }) {
  const meta = chipFor(status);
  if (!meta) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${meta.className}`}
    >
      {meta.pulse && (
        <span className="relative flex size-1.5" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
        </span>
      )}
      {meta.label}
    </span>
  );
}

function chipFor(status?: string):
  | { label: string; className: string; pulse?: boolean }
  | null {
  switch (status) {
    case "live":
      return {
        label: "Live",
        className:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        pulse: true,
      };
    case "beta_orgs_only":
    case "beta":
      return {
        label: "Beta",
        className: "border-brand/40 bg-brand-soft text-brand-ink",
      };
    case "in_development":
      return {
        label: "Early access",
        className: "border-brand/40 bg-brand-soft text-brand-ink",
      };
    case "coming_soon":
      return {
        label: "Coming soon",
        className: "border-border bg-muted text-muted-foreground",
      };
    case undefined:
      return {
        label: "Coming soon",
        className: "border-border bg-muted text-muted-foreground",
      };
    default:
      return null;
  }
}
