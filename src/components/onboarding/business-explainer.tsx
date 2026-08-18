import { Brain, Link2, PlusCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Explains what a "Business" is in Peakhour and why channels are scoped to one
 * Business. The isolation is a TECHNOLOGICAL boundary (each Business keeps its
 * own knowledge / workflow / learnings so its AI stays sharp and on-brand) —
 * NOT a paywall. Shown on the add-business flow (and reusable on /pricing).
 */
export function BusinessExplainer({ className }: { className?: string }) {
  const points = [
    {
      icon: Brain,
      title: "Its own brain",
      body: "Each Business keeps its own knowledge, brand voice, workflow, and learnings. Nothing bleeds between them — so every Business stays sharp and on-brand.",
    },
    {
      icon: Link2,
      title: "Same-Business channels only",
      body: "You connect a Business's own channels — website, Shopify, WordPress, LinkedIn, WhatsApp, newsletters. A channel that belongs to a different Business can't be attached. That's a technological boundary that protects each Business's brain, not a paywall.",
    },
    {
      icon: PlusCircle,
      title: "Add one anytime",
      body: "Running another brand, store, or client? Add a Business in a click. Free plans include one Business; on paid plans each additional Business is a simple add-on.",
    },
  ];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">What&apos;s a Business in Peakhour?</CardTitle>
        <CardDescription>
          A Business is one brand&apos;s workspace. Keep each brand, store, or
          client in its own Business so their data and AI never mix.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        {points.map((p) => (
          <div key={p.title} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <p.icon className="h-4 w-4 text-primary" aria-hidden />
              <span className="text-sm font-medium">{p.title}</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {p.body}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
