import { toast } from "sonner";

/** A toast, decided by pure code and shown by `showToast` — so the decision
 *  can be unit-tested without sonner. */
export interface ToastSpec {
  kind: "success" | "warning" | "error";
  title: string;
  description?: string;
}

/** Show a `ToastSpec` — the one place a spec becomes a sonner call. */
export function showToast(t: ToastSpec): void {
  toast[t.kind](t.title, t.description ? { description: t.description } : undefined);
}
