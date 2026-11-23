import { API_BASE_URL } from "@/lib/api";
import { downloadBlob } from "@/lib/download";

/** The api's file of one batch's approvals (S16, Pro tools). Free: it reads decisions, it makes nothing. */
export const batchApprovalsCsvPath = (batchId: string): string => `/v1/creative/batches/${encodeURIComponent(batchId)}/approvals.csv`;

export type ExportResult = "done" | "session" | "missing" | "failed";

/**
 * Fetch the file with the session cookie (not a bare link, so an expired session becomes a message here instead of a JSON error in a dead tab) and hand it to
 * the browser. Never throws: the caller maps the answer to a sentence from studio-copy.
 */
export async function exportBatchApprovals(batchId: string): Promise<ExportResult> {
  try {
    const res = await fetch(`${API_BASE_URL}${batchApprovalsCsvPath(batchId)}`, { credentials: "include" });
    if (res.status === 401) return "session";
    if (res.status === 404) return "missing";
    if (!res.ok) return "failed";
    downloadBlob(await res.blob(), `studio-approvals-${batchId}.csv`);
    return "done";
  } catch {
    return "failed";
  }
}
