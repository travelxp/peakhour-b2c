import { downloadConversationExport } from "@/lib/wa-conversation-export";
import { STUDIO_COPY } from "@/lib/studio-copy";

/** The api's file of one batch's approvals (S16, Pro tools). Free: it reads decisions, it makes nothing. */
export const batchApprovalsCsvPath = (batchId: string): string => `/v1/creative/batches/${encodeURIComponent(batchId)}/approvals.csv`;

const E = STUDIO_COPY.batch.exportApprovals;

/** The sentence for a refusal: what a person can do about it, not a status code. */
export function exportFailureLine(status: number): string {
  if (status === 401) return E.session;
  if (status === 403) return E.forbidden;
  if (status === 404) return E.missing;
  return E.failed;
}

/**
 * Fetch the file with the session cookie and hand it to the browser. The app's one authenticated-download helper does the work (it renews an idle tab's token once
 * and retries, takes the api's file name, and never throws); this only names the file and the sentences. `message` is set when it did not work.
 */
export async function exportBatchApprovals(batchId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const out = await downloadConversationExport(batchApprovalsCsvPath(batchId), `studio-approvals-${batchId}.csv`, exportFailureLine);
  return out.ok ? { ok: true } : { ok: false, message: out.message };
}
