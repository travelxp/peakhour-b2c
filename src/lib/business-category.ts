/**
 * The business category, edited from "Your business" (FR). The category decides the playbook and which goals can be offered, so only an
 * owner or admin changes it (the api refuses anyone else); this says so before the button is pressed and words what the api answered.
 */

export interface CategoryOption {
  value: string;
  label: string;
}

/** The api's answer to a category change: whether it changed, and what it did about the plan. */
export interface CategoryChangeResult {
  changed: boolean;
  plan:
    | { status: "none"; why: "no_plan" | "no_pin" | "no_answer" | "same_playbook" | "unchanged" }
    | { status: "proposed"; decisionId: string }
    | { status: "not_proposed"; code: string; message: string };
}

/** Mirrors the api: only an owner or an admin. Anything else, including an unknown role, is read-only. */
export function canChangeCategory(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

/** The category in plain words; an unlisted value reads as itself with its underscores taken out. */
export function categoryLabel(value: string | null | undefined, options: readonly CategoryOption[] | undefined): string | null {
  if (!value) return null;
  return options?.find((o) => o.value === value)?.label ?? value.replace(/_/g, " ");
}

/** What happened, in the merchant's words, after a save. `warn` is a plan move that could not be proposed. */
export function categoryChangeWords(r: CategoryChangeResult): { text: string; tone: "ok" | "warn" } {
  if (!r.changed) return { text: "That is already your category.", tone: "ok" };
  const p = r.plan;
  if (p.status === "proposed") {
    return { text: "Saved. Your plan can move to the playbook for this kind of business. We sent a confirmation link and code to your WhatsApp, and nothing changes until you confirm.", tone: "ok" };
  }
  if (p.status === "not_proposed") return { text: `Saved. ${p.message}`, tone: "warn" };
  if (p.why === "no_plan") return { text: "Saved. Peakhour will use it when it drafts your plan, so the goals offered may change.", tone: "ok" };
  return { text: "Saved. Your plan already fits this kind of business, so it stays as it is.", tone: "ok" };
}
