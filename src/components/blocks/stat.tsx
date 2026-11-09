import { ArrowDownRight, ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/utils"

function Stat({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="stat"
      className={cn("flex min-w-0 flex-col gap-1", className)}
      {...props}
    />
  )
}

function StatLabel({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="stat-label"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function StatValue({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="stat-value"
      className={cn(
        "text-2xl font-semibold tracking-tight tabular-nums",
        className
      )}
      {...props}
    />
  )
}

function StatDelta({
  trend = "up",
  className,
  children,
  ...props
}: React.ComponentProps<"p"> & { trend?: "up" | "down" }) {
  const Icon = trend === "up" ? ArrowUpRight : ArrowDownRight

  return (
    <p
      data-slot="stat-delta"
      data-trend={trend}
      className={cn(
        "flex items-center gap-1 text-xs font-medium",
        trend === "up" ? "text-chart-2" : "text-destructive",
        className
      )}
      {...props}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  )
}

function StatIcon({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="stat-icon"
      className={cn(
        "bg-muted text-foreground flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4",
        className
      )}
      {...props}
    />
  )
}

export { Stat, StatDelta, StatIcon, StatLabel, StatValue }
