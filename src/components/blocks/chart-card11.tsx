"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
interface ChartCard11Props {
  title?: string;
  description?: string;
  className?: string;
}

const chartData = [
  { category: "Electronics", inStock: 65, lowStock: 20, outOfStock: 15 },
  { category: "Clothing", inStock: 72, lowStock: 18, outOfStock: 10 },
  { category: "Home", inStock: 58, lowStock: 25, outOfStock: 17 },
  { category: "Sports", inStock: 80, lowStock: 12, outOfStock: 8 },
  { category: "Books", inStock: 45, lowStock: 35, outOfStock: 20 },
];

const chartConfig = {
  inStock: {
    label: "In Stock",
    color: "var(--chart-1)",
  },
  lowStock: {
    label: "Low Stock",
    color: "var(--chart-4)",
  },
  outOfStock: {
    label: "Out of Stock",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

const ChartCard11 = ({
  title = "Inventory Status",
  description = "Stock levels by category (percentage)",
  className,
}: ChartCard11Props) => {
  return (
    <Card className={cn("w-full max-w-2xl", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            stackOffset="expand"
            barSize={24}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              fontSize={12}
              tickFormatter={(value) => `${Math.round(value * 100)}%`}
            />
            <YAxis
              type="category"
              dataKey="category"
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              fontSize={12}
              width={80}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <span>
                      {chartConfig[name as keyof typeof chartConfig]?.label}:{" "}
                      {value}%
                    </span>
                  )}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="inStock"
              stackId="a"
              fill="var(--color-inStock)"
              radius={[4, 0, 0, 4]}
            />
            <Bar
              dataKey="lowStock"
              stackId="a"
              fill="var(--color-lowStock)"
              radius={0}
            />
            <Bar
              dataKey="outOfStock"
              stackId="a"
              fill="var(--color-outOfStock)"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export { ChartCard11 };
