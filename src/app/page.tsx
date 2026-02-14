import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const FEATURES = [
  {
    title: "Content Intelligence",
    description:
      "Every piece of content is automatically tagged across 12 dimensions. Know which topics, audiences, and angles drive results.",
    detail: "Beehiiv sync, 12-dimension auto-tagger, content gap analysis",
  },
  {
    title: "AI Creative Factory",
    description:
      "Turn one newsletter into 10+ platform-native ad creatives in minutes. LinkedIn Lead Gen, Meta, Google — all from your content.",
    detail: "Claude AI generates headlines, body copy, image briefs",
  },
  {
    title: "Optimization Engine",
    description:
      "AI monitors performance hourly. Underperformers get paused, winners get boosted, budgets get rebalanced automatically.",
    detail: "Daily optimization, weekly strategy, monthly pattern mining",
  },
] as const;

const STEPS = [
  {
    step: "1",
    title: "Connect your content",
    description:
      "Link your Beehiiv newsletter (or upload content). We sync and analyze everything automatically.",
  },
  {
    step: "2",
    title: "AI tags and creates ads",
    description:
      "Our AI reads every piece, tags it across 12 dimensions, scores ad potential, and generates platform-native creatives.",
  },
  {
    step: "3",
    title: "Launch and optimize",
    description:
      "Deploy to LinkedIn, Google, or Meta. The AI monitors hourly, pauses losers, boosts winners, and rebalances budgets.",
  },
] as const;

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <span className="text-lg font-bold">PeakHour</span>
          <nav className="flex items-center gap-4">
            <Link
              href="/auth/login"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Sign in
            </Link>
            <Button asChild size="sm">
              <Link href="/auth/register">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Your AI Marketing Department
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          PeakHour turns your content into high-performing ads across every
          platform. Content intelligence, creative factory, and optimization
          engine — all powered by AI, all on autopilot.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/auth/register">Start free</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="#how-it-works">How it works</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/40 py-20">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-3xl font-bold">
            Three engines, one platform
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Everything your marketing team does — content analysis, ad creation,
            performance optimization — automated by AI.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title}>
                <CardHeader>
                  <CardTitle className="text-lg">{f.title}</CardTitle>
                  <CardDescription>{f.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{f.detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-3xl font-bold">
            Up and running in 3 steps
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.step} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                  {s.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {s.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-muted/40 py-20">
        <div className="mx-auto max-w-xl px-4 text-center">
          <h2 className="text-3xl font-bold">
            Stop doing marketing. Start growing.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Join businesses that replaced their marketing busywork with an AI
            engine that works 24/7.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/auth/register">Get started free</Link>
          </Button>
        </div>
      </section>

      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-5xl px-4 text-center text-sm text-muted-foreground">
          <div className="flex justify-center gap-4">
            <Link href="/privacy-policy" className="underline">
              Privacy Policy
            </Link>
            <Link href="/terms" className="underline">
              Terms of Service
            </Link>
          </div>
          <p className="mt-2">
            PeakHour &copy; {new Date().getFullYear()}. AI-powered marketing for
            growing businesses.
          </p>
        </div>
      </footer>
    </div>
  );
}
