"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
interface ChartCard27Props {
  title?: string;
  description?: string;
  className?: string;
}

const chartData = [
  { time: "00:00", value: 45 },
  { time: "04:00", value: 52 },
  { time: "08:00", value: 78 },
  { time: "12:00", value: 95 },
  { time: "16:00", value: 88 },
  { time: "20:00", value: 72 },
  { time: "24:00", value: 58 },
];

const chartConfig = {
  value: {
    label: "CPU Usage",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const ChartCard27 = ({
  title = "System Load",
  description = "CPU usage with threshold zones",
  className,
}: ChartCard27Props) => {
  return (
    <Card className={cn("w-full max-w-2xl", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="chartGradient27" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-value)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-value)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            {/* Zone backgrounds */}
            <ReferenceArea
              y1={0}
              y2={60}
              fill="var(--chart-1)"
              fillOpacity={0.05}
            />
            <ReferenceArea
              y1={60}
              y2={80}
              fill="var(--chart-4)"
              fillOpacity={0.1}
            />
            <ReferenceArea
              y1={80}
              y2={100}
              fill="var(--chart-5)"
              fillOpacity={0.15}
            />
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="time"
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              fontSize={12}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              fontSize={12}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent formatter={(value) => `${value}%`} />
              }
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--color-value)"
              strokeWidth={2}
              fill="url(#chartGradient27)"
            />
          </AreaChart>
        </ChartContainer>
        {/* Zone legend */}
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <div className="size-3 rounded-sm bg-chart-1/20" />
            Normal (0-60%)
          </span>
          <span className="flex items-center gap-1.5">
            <div className="size-3 rounded-sm bg-chart-4/30" />
            Warning (60-80%)
          </span>
          <span className="flex items-center gap-1.5">
            <div className="size-3 rounded-sm bg-chart-5/40" />
            Critical (80-100%)
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export { ChartCard27 };
