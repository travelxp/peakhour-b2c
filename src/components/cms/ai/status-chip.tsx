import { Badge } from "@/components/ui/badge";

const VARIANT: Record<string, string> = {
  success: "bg-success/15 text-success-on-tint hover:bg-success/30",
  error: "bg-destructive/15 text-destructive-on-tint hover:bg-destructive/30",
  rate_limited: "bg-warning/15 text-warning-on-tint hover:bg-warning/25",
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
