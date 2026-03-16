"use client";

import { Megaphone } from "lucide-react";

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
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-muted to-muted/60 border border-border/50 shadow-sm mb-4">
              <Megaphone className="h-8 w-8 text-muted-foreground" />
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
