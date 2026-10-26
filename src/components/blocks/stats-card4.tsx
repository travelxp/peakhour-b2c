import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
interface StatsCard4Props {
  title?: string;
  currentValue?: string;
  currentLabel?: string;
  previousValue?: string;
  previousLabel?: string;
  className?: string;
}

const StatsCard4 = ({
  title = "Revenue",
  currentValue = "$12,450",
  currentLabel = "This month",
  previousValue = "$10,230",
  previousLabel = "Last month",
  className,
}: StatsCard4Props) => {
  return (
    <Card className={cn("w-full max-w-xs", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-2xl font-bold">{currentValue}</div>
            <div className="text-sm text-muted-foreground">{currentLabel}</div>
          </div>
          <div className="border-l pl-4">
            <div className="text-2xl font-bold text-muted-foreground">
              {previousValue}
            </div>
            <div className="text-sm text-muted-foreground">{previousLabel}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export { StatsCard4 };
