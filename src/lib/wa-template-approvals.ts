/** The shape of `GET /v1/meta/whatsapp/template-approvals` (peakhour-api `getMerchantTemplateApprovals`, lane T1). */
export type ApprovalState = "approved" | "waiting" | "not_approved";

export interface TemplateApproval {
  /** The message's name on Meta, so it can be found in WhatsApp Manager. */
  name: string;
  language: string;
  /** What the message says, in a sentence. */
  purpose: string;
  /** What switches on when Meta approves it. */
  unlocks: string;
  state: ApprovalState;
  /** The api's plain sentence for this state, including what Peakhour does next. */
  message: string;
  /** Meta's own reason, when it gave one. */
  reason: string | null;
}

export interface TemplateApprovals {
  connected: boolean;
  allApproved: boolean;
  counts: { approved: number; waiting: number; notApproved: number };
  templates: TemplateApproval[];
}
