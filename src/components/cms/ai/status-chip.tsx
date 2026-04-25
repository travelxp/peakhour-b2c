import { Badge } from "@/components/ui/badge";

const VARIANT: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  error: "bg-red-100 text-red-800 hover:bg-red-100",
  rate_limited: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  fallback_used: "bg-violet-100 text-violet-800 hover:bg-violet-100",
};

const LABEL: Record<string, string> = {
  success: "OK",
  error: "Error",
  rate_limited: "Rate-limited",
  fallback_used: "Fallback",
};

export function StatusChip({ status }: { status?: string }) {
  const key = status || "success";
  return (
    <Badge variant="secondary" className={VARIANT[key] || ""}>
      {LABEL[key] || key}
    </Badge>
  );
}
