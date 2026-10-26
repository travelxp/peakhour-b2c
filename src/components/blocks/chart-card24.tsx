"use client";

import {
  CartesianGrid,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
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
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
interface ChartCard24Props {
  title?: string;
  description?: string;
  className?: string;
}

const dataA = [
  { x: 100, y: 200, z: 200 },
  { x: 120, y: 100, z: 260 },
  { x: 170, y: 300, z: 400 },
  { x: 140, y: 250, z: 280 },
  { x: 150, y: 400, z: 500 },
  { x: 110, y: 280, z: 200 },
];

const dataB = [
  { x: 200, y: 260, z: 240 },
  { x: 240, y: 290, z: 220 },
  { x: 190, y: 290, z: 250 },
  { x: 198, y: 250, z: 210 },
  { x: 180, y: 280, z: 260 },
  { x: 210, y: 220, z: 230 },
];

const chartConfig = {
  groupA: {
    label: "Group A",
    color: "var(--chart-1)",
  },
  groupB: {
    label: "Group B",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const ChartCard24 = ({
  title = "Market Segments",
  description = "Price, volume, and revenue by segment",
  className,
}: ChartCard24Props) => {
  return (
    <Card className={cn("w-full max-w-2xl", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              name="Price"
              unit="$"
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              fontSize={12}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Volume"
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              fontSize={12}
            />
            <ZAxis type="number" dataKey="z" range={[40, 400]} name="Revenue" />
            <ChartTooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={
                <ChartTooltipContent
                  formatter={(value, name) => {
                    if (name === "x") return `Price: $${value}`;
                    if (name === "y") return `Volume: ${value}`;
                    if (name === "z") return `Revenue: $${value}k`;
                    return `${name}: ${value}`;
                  }}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Scatter
              name="groupA"
              data={dataA}
              fill="var(--color-groupA)"
              fillOpacity={0.7}
            />
            <Scatter
              name="groupB"
              data={dataB}
              fill="var(--color-groupB)"
              fillOpacity={0.7}
            />
          </ScatterChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export { ChartCard24 };
