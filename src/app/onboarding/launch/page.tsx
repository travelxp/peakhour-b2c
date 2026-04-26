"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2, ArrowRight, Sparkles, Mail, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DiscoveryStatus {
  status: "pending" | "running" | "done" | "failed";
  currentPhase: "tech_stack" | "footprint" | "recommendations" | null;
  phasesCompleted: string[];
  attempts: number;
  lastError: string | null;
  finishedAt: string | null;
  updatedAt: string | null;
}

const PHASES: Array<{
  id: "tech_stack" | "footprint" | "recommendations";
  label: string;
  description: string;
}> = [
  {
    id: "tech_stack",
    label: "Looking up your website",
    description: "Detecting how your site is built — WordPress, Shopify, Webflow, you name it.",
  },
  {
    id: "footprint",
    label: "Finding your other profiles",
    description: "Searching the web for the rest of your accounts so you don't have to type them all in.",
  },
  {
    id: "recommendations",
    label: "Picking your best places to grow",
    description: "Choosing two or three platforms that actually fit what you do.",
  },
];

const POLL_INTERVAL_MS = 3000;

export default function LaunchPage() {
  const router = useRouter();
  const { org, refreshUser } = useAuth();
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<DiscoveryStatus | null>(null);
  const [pollError, setPollError] = useState("");
  const [emailToggle, setEmailToggle] = useState(false);

  // Pull jobId from session — set by /confirm handler in the about page.
  useEffect(() => {
    const id = sessionStorage.getItem("onboarding:jobId");
    if (!id) {
      // No active job — most likely a returning user. Fall back to dashboard.
      router.replace("/dashboard/overview");
      return;
    }
    setJobId(id);
  }, [router]);

  // Poll discovery status every 3 seconds while the job is alive
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const r = await api.get<DiscoveryStatus>(
          `/v1/onboarding/discovery-status?jobId=${jobId}`,
        );
        if (cancelled) return;
        setStatus(r);
        setPollError("");
        // Stop polling on terminal states
        if (r.status === "done" || r.status === "failed") return;
        timeoutId = setTimeout(tick, POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          // Job not found — likely a stale jobId; clear and redirect
          sessionStorage.removeItem("onboarding:jobId");
          router.replace("/dashboard/overview");
          return;
        }
        setPollError(
          err instanceof ApiError ? err.message : "Couldn't check progress.",
        );
        // On transient error, retry — but back off slightly
        timeoutId = setTimeout(tick, POLL_INTERVAL_MS * 2);
      }
    };
    tick();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [jobId, router]);

  const isDone = status?.status === "done";
  const isFailed = status?.status === "failed";

  // When we transition to terminal — refresh user so any auth-side flags
  // (onboarding.steps.discoveryJobCompleted) reflect on the dashboard.
  useEffect(() => {
    if (isDone || isFailed) {
      refreshUser().catch(() => { /* non-critical */ });
    }
  }, [isDone, isFailed, refreshUser]);

  const completedSet = useMemo(
    () => new Set(status?.phasesCompleted ?? []),
    [status?.phasesCompleted],
  );

  return (
    <div className="space-y-8">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          {isDone ? <CheckCircle2 className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
        </div>
        <h1 className="text-4xl font-semibold tracking-tight">
          {isDone
            ? "You're all set"
            : isFailed
              ? "We hit a snag"
              : "We're working on it"}
        </h1>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          {isDone
            ? `Welcome to peakhour, ${org?.name ?? "friend"}. Your dashboard is ready.`
            : isFailed
              ? "Don't worry — you can still use the dashboard. We'll try again automatically."
              : "Feel free to close this tab. We'll keep going in the background."}
        </p>
      </div>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            What we're doing
          </CardTitle>
          <CardDescription>
            Three quick steps. They usually finish in under a minute.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {PHASES.map((phase) => {
            const isComplete = completedSet.has(phase.id);
            const isCurrent = !isComplete && status?.currentPhase === phase.id;
            return (
              <PhaseRow
                key={phase.id}
                label={phase.label}
                description={phase.description}
                state={
                  isComplete ? "done" : isCurrent ? "running" : "pending"
                }
              />
            );
          })}
          {pollError && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              {pollError} (retrying)
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3">
          <Button
            size="lg"
            className="w-full"
            onClick={() => {
              sessionStorage.removeItem("onboarding:jobId");
              router.push("/dashboard/overview");
            }}
          >
            <span className="flex items-center gap-2">
              {isDone ? "Open my dashboard" : "Take me to my dashboard"}
              <ArrowRight className="h-4 w-4" />
            </span>
          </Button>
          {!isDone && !isFailed && (
            <button
              type="button"
              onClick={() => setEmailToggle((v) => !v)}
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Mail className="h-4 w-4" />
              {emailToggle
                ? "We'll email you when everything's ready"
                : "Email me when ready"}
            </button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

function PhaseRow({
  label,
  description,
  state,
}: {
  label: string;
  description: string;
  state: "pending" | "running" | "done";
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md p-3 transition-colors",
        state === "running" && "bg-primary/5",
      )}
    >
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors",
          state === "done" && "bg-emerald-500 text-white",
          state === "running" && "border-2 border-primary text-primary",
          state === "pending" && "border border-muted-foreground/30 text-muted-foreground",
        )}
      >
        {state === "done" && <CheckCircle2 className="h-4 w-4" />}
        {state === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium transition-colors",
            state === "pending" && "text-muted-foreground",
          )}
        >
          {label}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}
