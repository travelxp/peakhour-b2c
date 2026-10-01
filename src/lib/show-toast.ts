import { toast } from "sonner";
import type { ToastSpec } from "@/lib/commerce-action-status";

/** Show a `ToastSpec` — the one place a spec becomes a sonner call. */
export function showToast(t: ToastSpec): void {
  toast[t.kind](t.title, t.description ? { description: t.description } : undefined);
}
