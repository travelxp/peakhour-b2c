"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Ad Campaigns</h2>
        <p className="text-muted-foreground">
          AI-generated ads reaching your ideal customers
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            Your AI marketing engine will create and manage ad campaigns
            automatically. Once your content is tagged and your ad account is
            connected, campaigns will appear here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <svg
                aria-hidden="true"
                className="h-8 w-8 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5"
                />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground max-w-sm">
              The AI will analyze your best content, generate ad creatives, and
              deploy them to your connected platforms — all automatically.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
