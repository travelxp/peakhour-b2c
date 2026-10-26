"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
interface StatsCard2Props {
  title?: string;
  value?: string;
  data?: { value: number }[];
  className?: string;
}

const defaultData = [
  { value: 186 },
  { value: 305 },
  { value: 237 },
  { value: 273 },
  { value: 209 },
  { value: 314 },
  { value: 290 },
];

const StatsCard2 = ({
  title = "Active Users",
  value = "2,350",
  data = defaultData,
  className,
}: StatsCard2Props) => {
  return (
    <Card className={cn("w-full max-w-xs", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="text-3xl font-bold">{value}</div>
        <div className="mt-3 h-16">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient
                  id="sparklineGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="var(--chart-1)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--chart-1)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#sparklineGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export { StatsCard2 };
