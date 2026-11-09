"use client";

import { cn } from "@/lib/utils";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
interface FunnelStep {
  label: string;
  value: number;
  color?: string;
}

interface ChartCard21Props {
  title?: string;
  description?: string;
  data?: FunnelStep[];
  className?: string;
}

const defaultData: FunnelStep[] = [
  { label: "Visitors", value: 10000 },
  { label: "Leads", value: 6500 },
  { label: "Qualified", value: 3200 },
  { label: "Proposals", value: 1800 },
  { label: "Closed", value: 950 },
];

const ChartCard21 = ({
  title = "Sales Funnel",
  description = "Conversion through pipeline stages",
  data = defaultData,
  className,
}: ChartCard21Props) => {
  const maxValue = Math.max(...data.map((d) => d.value));
  const colors = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];

  return (
    <Card className={cn("w-full max-w-2xl", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((step, index) => {
            const widthPercent = (step.value / maxValue) * 100;
            const conversionRate =
              index > 0
                ? ((step.value / data[index - 1].value) * 100).toFixed(1)
                : null;

            return (
              <div key={step.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{step.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {step.value.toLocaleString()}
                    </span>
                    {conversionRate && (
                      <span className="text-xs text-muted-foreground">
                        ({conversionRate}%)
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-8 w-full rounded-sm bg-muted">
                  <div
                    className="flex h-full items-center justify-center rounded-sm transition-all duration-500"
                    style={{
                      width: `${widthPercent}%`,
                      backgroundColor:
                        step.color || colors[index % colors.length],
                    }}
                  >
                    {widthPercent > 15 && (
                      <span className="text-xs font-medium text-white">
                        {((step.value / maxValue) * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export { ChartCard21 };
