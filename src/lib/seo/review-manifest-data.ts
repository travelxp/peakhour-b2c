import { PAGE_APPROVALS, type PageApproval } from "./approvals";

/* The manifest's shape and the light helpers the dev route needs (review-manifest.ts, which builds it, imports every page's copy). */

export const DEV_ORIGIN = "https://dev.peakhour.ai";

export type ReviewManifestPage = {
  pageId: string;
  path: string;
  family: string;
  title: string;
  editorialStatus: "published" | "review";
  devUrl: string;
  /** Every approved claim of every capability the page leans on; status is the capability's evidence status on the page's surface. */
  claims: { id: string; text: string; status: string }[];
  comparison?: {
    vendor: string;
    /** "<value>" or "<value>: <note>", the cell as a reader sees it. sourceUrl and observedAt are the VENDOR cell's. */
    rows: { dimension: string; peakhour: string; vendor: string; sourceUrl?: string; observedAt?: string }[];
    pricing: { plan: string; price: string; currency?: string; region?: string; sourceUrl?: string; observedAt?: string }[];
  };
  /** "sha256:" + hex over a canonical JSON of what the reader sees and what it claims. Never includes the approval or the editorial status. */
  contentHash: string;
  /** "Reviewed by" on the page: the reviewer of a current `cms` approval, else null (a placeholder approval never counts). */
  reviewedBy: string | null;
  approval: { source: "cms" | "placeholder"; reviewer: string; approvedAt: string; contentHash: string } | null;
};

export type ReviewManifest = { version: 1; pages: ReviewManifestPage[] };

export function latestApproval(pageId: string, approvals: readonly PageApproval[]): ReviewManifestPage["approval"] {
  let latest: PageApproval | undefined;
  for (const a of approvals) if (a.pageId === pageId) latest = a;
  return latest ? { source: latest.source, reviewer: latest.reviewer, approvedAt: latest.approvedAt, contentHash: latest.contentHash } : null;
}

/** The approval fields of a page: its latest approval and who it names as reviewer (a current cms approval only; a placeholder never counts). */
export function approvalFields(pageId: string, contentHash: string, approvals: readonly PageApproval[]): Pick<ReviewManifestPage, "approval" | "reviewedBy"> {
  const approval = latestApproval(pageId, approvals);
  const reviewedBy = approval && approval.source === "cms" && approval.contentHash === contentHash && approval.reviewer.trim() !== "" ? approval.reviewer : null;
  return { approval, reviewedBy };
}

/** The manifest with every approval cleared: approvals.ts is the source of truth for those, so the freshness test compares without them. */
export function withoutApprovals(manifest: ReviewManifest): ReviewManifest {
  return { ...manifest, pages: manifest.pages.map((p) => ({ ...p, approval: null, reviewedBy: null })) };
}

/** `manifest` with the approvals of `approvals` laid over each page: what the dev route serves, so an approval shows without regenerating the file. */
export function overlayApprovals(manifest: ReviewManifest, approvals: readonly PageApproval[] = PAGE_APPROVALS): ReviewManifest {
  return { ...manifest, pages: manifest.pages.map((p) => ({ ...p, ...approvalFields(p.pageId, p.contentHash, approvals) })) };
}
