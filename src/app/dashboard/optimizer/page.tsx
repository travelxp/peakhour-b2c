"use client";

import { Sparkles } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function OptimizerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">AI Optimizer</h2>
        <p className="text-muted-foreground">
          The AI continuously improves your marketing performance
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            The optimizer automatically shifts budget to your best-performing
            content and audiences, runs experiments, and learns what works.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-muted to-muted/60 border border-border/50 shadow-sm mb-4">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground max-w-sm">
              Think of it as a marketing team member who never sleeps — always
              testing, learning, and optimizing to get you more customers for
              less money.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
