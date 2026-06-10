import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function PeaksLoading() {
  return (
    <div className="space-y-6">
      <div className="h-16 w-48 animate-pulse rounded-md bg-muted" />
      <Card>
        <CardHeader>
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="h-20 animate-pulse rounded-md bg-muted" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
