"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function BudgetPage() {
  const router = useRouter();
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [dailyCap, setDailyCap] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const monthly = parseFloat(monthlyBudget);
    const daily = parseFloat(dailyCap);

    if (isNaN(monthly) || monthly < 0) {
      setError("Please enter a valid monthly budget");
      setLoading(false);
      return;
    }

    try {
      await api.put("/v1/onboarding/budget", {
        monthlyBudget: monthly,
        dailyCap: isNaN(daily) ? Math.round(monthly / 30) : daily,
      });
      router.push("/onboarding/launch");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set your budget</CardTitle>
        <CardDescription>
          How much do you want to spend on ads each month? You can change this
          anytime.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="monthlyBudget">Monthly budget (USD)</Label>
            <Input
              id="monthlyBudget"
              type="number"
              min="0"
              step="1"
              placeholder="500"
              value={monthlyBudget}
              onChange={(e) => setMonthlyBudget(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dailyCap">
              Daily cap (USD){" "}
              <span className="text-muted-foreground font-normal">— optional</span>
            </Label>
            <Input
              id="dailyCap"
              type="number"
              min="0"
              step="1"
              placeholder={
                monthlyBudget
                  ? String(Math.round(parseFloat(monthlyBudget) / 30))
                  : "17"
              }
              value={dailyCap}
              onChange={(e) => setDailyCap(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Defaults to monthly budget / 30 if not set
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            type="submit"
            className="w-full"
            disabled={loading || !monthlyBudget}
          >
            {loading ? "Saving..." : "Continue"}
          </Button>
          <button
            type="button"
            onClick={() => router.push("/onboarding/launch")}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Skip for now
          </button>
        </CardFooter>
      </form>
    </Card>
  );
}
