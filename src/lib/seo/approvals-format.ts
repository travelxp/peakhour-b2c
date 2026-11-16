/*
 * The one line format of src/lib/seo/approvals.ts, between the marker lines. The approvals file is machine-edited:
 * peakhour-api (the CMS approval screen) appends and removes whole lines by text edit, so a row is always ONE line in
 * exactly this shape, sorted by pageId. peakhour-api copies APPROVAL_LINE and the two markers; a test here fails if the
 * file stops matching, which is what keeps the two repos honest.
 *
 *   `  { pageId: "...", contentHash: "sha256:<64 hex>", reviewer: "...", approvedAt: "YYYY-MM-DD", source: "cms" },`
 *
 * A reviewer name or pageId never holds a double quote or a backslash (the line would no longer match).
 */

export const APPROVALS_BEGIN = "// approvals:begin";
export const APPROVALS_END = "// approvals:end";

export const APPROVAL_LINE =
  /^ {2}\{ pageId: "([^"\\\r\n]+)", contentHash: "(sha256:[0-9a-f]{64})", reviewer: "([^"\\\r\n]*)", approvedAt: "(\d{4}-\d{2}-\d{2})", source: "(cms|placeholder)" \},$/;

export type ApprovalSource = "cms" | "placeholder";

export type PageApproval = {
  pageId: string;
  contentHash: string;
  reviewer: string;
  approvedAt: string;
  source: ApprovalSource;
};

/** The one line for a row, in the exact format the api writes. */
export function formatApprovalLine(a: PageApproval): string {
  return `  { pageId: "${a.pageId}", contentHash: "${a.contentHash}", reviewer: "${a.reviewer}", approvedAt: "${a.approvedAt}", source: "${a.source}" },`;
}

/** The rows between the markers of an approvals.ts source, in file order. Throws on a marker missing or a line that does not match. */
export function parseApprovalsSource(source: string): PageApproval[] {
  const lines = source.split(/\r?\n/);
  const a = lines.findIndex((l) => l.trim() === APPROVALS_BEGIN);
  const b = lines.findIndex((l) => l.trim() === APPROVALS_END);
  if (a < 0 || b < a) throw new Error("approvals.ts has no approvals:begin / approvals:end markers");
  const rows: PageApproval[] = [];
  for (const line of lines.slice(a + 1, b)) {
    if (line.trim() === "") continue;
    const m = APPROVAL_LINE.exec(line);
    if (!m) throw new Error(`approvals.ts line does not match the row format: ${line}`);
    rows.push({ pageId: m[1], contentHash: m[2], reviewer: m[3], approvedAt: m[4], source: m[5] as ApprovalSource });
  }
  return rows;
}
