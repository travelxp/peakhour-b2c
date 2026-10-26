"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
interface ChartCard14Props {
  title?: string;
  description?: string;
  className?: string;
}

const chartData = [
  { month: "Jan", min: 120, max: 180, avg: 150 },
  { month: "Feb", min: 140, max: 220, avg: 175 },
  { month: "Mar", min: 130, max: 195, avg: 160 },
  { month: "Apr", min: 155, max: 240, avg: 190 },
  { month: "May", min: 145, max: 210, avg: 175 },
  { month: "Jun", min: 160, max: 250, avg: 200 },
  { month: "Jul", min: 170, max: 260, avg: 215 },
  { month: "Aug", min: 165, max: 245, avg: 205 },
];

const chartConfig = {
  range: {
    label: "Range",
    color: "var(--chart-1)",
  },
  avg: {
    label: "Average",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const ChartCard14 = ({
  title = "Response Time Range",
  description = "Min, max, and average response times",
  className,
}: ChartCard14Props) => {
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
              <linearGradient id="rangeGradient14" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--chart-1)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="100%"
                  stopColor="var(--chart-1)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="month"
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
              tickFormatter={(value) => `${value}ms`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => {
                    if (name === "min") return `Min: ${value}ms`;
                    if (name === "max") return `Max: ${value}ms`;
                    if (name === "avg") return `Avg: ${value}ms`;
                    return `${value}ms`;
                  }}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="max"
              stackId="1"
              stroke="var(--chart-1)"
              fill="url(#rangeGradient14)"
              strokeWidth={0}
            />
            <Area
              type="monotone"
              dataKey="min"
              stackId="1"
              stroke="var(--chart-1)"
              fill="var(--background)"
              strokeWidth={0}
            />
            <Area
              type="monotone"
              dataKey="avg"
              stroke="var(--chart-2)"
              fill="none"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export { ChartCard14 };
