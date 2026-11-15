import { CircleCheck, Clock3, FlaskConical, PauseCircle } from "lucide-react";
import type { ReleaseStatus } from "@/lib/seo/types";
import { cn } from "@/lib/utils";
import { cardCls } from "./styles";
import { statusMeta, TONE_CLASS } from "./status-meta";

const ICON = { ok: CircleCheck, warn: FlaskConical, mute: Clock3 } as const;

/** The Live, Beta or Coming soon chip. */
export function StatusChip({ status, className }: { status: ReleaseStatus; className?: string }) {
  const meta = statusMeta(status);
  const Icon = status === "paused" || status === "retired" ? PauseCircle : ICON[meta.tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-micro font-bold",
        TONE_CLASS[meta.tone],
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" strokeWidth={2.5} />
      {meta.label}
    </span>
  );
}

/**
 * A capability's status, as the registry has it, with what it does NOT do. The limits are part of the answer,
 * not fine print: a reader (or an answer engine) should get both halves.
 */
export function CapabilityStatus({
  status,
  limitations = [],
  verifiedAt,
  subject,
  className,
}: {
  status: ReleaseStatus;
  limitations?: string[];
  /** ISO date the evidence was last read. */
  verifiedAt?: string;
  /** What the status is about, e.g. "WhatsApp COD confirmation on Shopify". */
  subject?: string;
  className?: string;
}) {
  const meta = statusMeta(status);
  return (
    <div className={cn(cardCls, "p-5 sm:p-6", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <StatusChip status={status} />
        <p className="text-[15px] font-semibold">
          {subject ? `${subject}: ` : ""}
          {meta.description}
        </p>
      </div>
      {limitations.length > 0 && (
        <>
          <h3 className="mt-5 text-sm font-extrabold uppercase tracking-[0.12em] text-muted-foreground">What it does not do</h3>
          <ul className="mt-2 grid gap-1.5 text-[15px]">
            {limitations.map((l) => (
              <li key={l} className="flex gap-2.5">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground/60" />
                {l}
              </li>
            ))}
          </ul>
        </>
      )}
      {verifiedAt && (
        <p className="mt-4 text-sm text-muted-foreground">
          Checked against the product on <time dateTime={verifiedAt}>{verifiedAt}</time>.
        </p>
      )}
    </div>
  );
}
