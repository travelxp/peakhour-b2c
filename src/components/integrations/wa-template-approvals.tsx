"use client";

import { Badge } from "@/components/ui/badge";
import { useWaTemplateApprovals } from "@/hooks/use-wa-template-approvals";
import type { ApprovalState, TemplateApprovals } from "@/lib/wa-template-approvals";

const LABEL: Record<ApprovalState, string> = {
  approved: "Approved",
  waiting: "Waiting for Meta",
  not_approved: "Not approved",
};
const VARIANT: Record<ApprovalState, "default" | "secondary" | "destructive"> = {
  approved: "default",
  waiting: "secondary",
  not_approved: "destructive",
};

/**
 * The messages Meta must approve. Pure given its data (the container below reads the hook), and it renders nothing when
 * WhatsApp is not connected or Peakhour has no message to send: an empty box would read as "nothing is happening".
 */
export function TemplateApprovalsView({ data }: { data: TemplateApprovals }) {
  if (!data.connected || data.templates.length === 0) return null;
  return (
    <section className="rounded-lg border p-4" aria-labelledby="wa-approvals-heading">
      <h2 id="wa-approvals-heading" className="text-sm font-medium">
        Messages Meta must approve
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Peakhour sends these to Meta for you. Each one switches on its feature once Meta approves it.
        {data.allApproved ? " All of them are approved." : ""}
      </p>
      <ul className="mt-3 divide-y">
        {data.templates.map((t) => (
          <li key={`${t.name}|${t.language}`} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">{t.purpose}</p>
              <p className="text-xs text-muted-foreground">Needed for: {t.unlocks}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t.message}</p>
              {t.state === "not_approved" && t.reason ? (
                <p className="mt-1 text-xs text-muted-foreground">Meta said: {t.reason}</p>
              ) : null}
            </div>
            <Badge variant={VARIANT[t.state]} data-state={t.state} className="shrink-0 self-start">
              {LABEL[t.state]}
            </Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function WaTemplateApprovals() {
  const { data } = useWaTemplateApprovals();
  return data ? <TemplateApprovalsView data={data} /> : null;
}
