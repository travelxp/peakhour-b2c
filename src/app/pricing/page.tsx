import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";

const PLANS = [
  {
    name: "Free",
    price: "0",
    description: "See what AI can do with your content",
    features: ["50 content pieces tagged", "Ad creative preview", "Content gap analysis"],
    cta: "Start free",
    highlighted: false,
  },
  {
    name: "Growth",
    price: "7,499",
    description: "Full AI marketing engine for growing businesses",
    features: ["Unlimited content tagging", "2 ad platforms", "Full optimization engine", "Pattern mining & insights", "Lead tracking"],
    cta: "Get started",
    highlighted: true,
  },
  {
    name: "Pro",
    price: "19,999",
    description: "For businesses ready to scale aggressively",
    features: ["Everything in Growth", "All ad platforms", "Subscriber enrichment", "Custom taxonomy", "API access"],
    cta: "Get started",
    highlighted: false,
  },
] as const;

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main>
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h1 className="text-center text-3xl font-bold">Simple, transparent pricing</h1>
            <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
              Start free. Upgrade when you&apos;re ready to launch ads.
            </p>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {PLANS.map((plan) => (
                <Card key={plan.name} className={plan.highlighted ? "relative border-primary shadow-lg" : undefined}>
                  {plan.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                      Most popular
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-bold">&#8377;{plan.price}</span>
                      {plan.price !== "0" && <span className="text-sm text-muted-foreground">/month</span>}
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2 text-sm">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button asChild className="w-full" variant={plan.highlighted ? "default" : "outline"}>
                      <Link href="/auth">{plan.cta}</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
