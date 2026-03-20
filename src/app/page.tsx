import Link from "next/link";
import { Brain, Rocket, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GradientButton } from "@/components/ui/gradient-button";
import { MonoLabel } from "@/components/ui/mono-label";
import { CharacterFloatCard } from "@/components/ui/character-float-card";
import { CharacterShowcaseCard } from "@/components/ui/character-showcase-card";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { UrlHeroInput } from "@/components/home/url-hero-input";

const FEATURES = [
  {
    icon: Brain,
    title: "Prime Time",
    description:
      "Broadcast at the perfect biological window. Our intelligence engine predicts global engagement peaks with 99.4% accuracy.",
    stagger: "",
  },
  {
    icon: BarChart2,
    title: "Signal Clarity",
    description:
      "Zero noise. Pure precision. Deep dark surfaces reveal high-fidelity insights into every micro-interaction across your network.",
    stagger: "md:mt-24",
  },
  {
    icon: Rocket,
    title: "Character at Scale",
    description:
      "Scale individual identity without diluting soul. Deploy hundreds of unique characters that maintain perfect brand alignment.",
    stagger: "md:mt-48",
  },
] as const;

const LIFECYCLE = [
  {
    step: "01",
    label: "Train",
    title: "Claude API Reasoning",
    description:
      "Inject your brand DNA. Our characters utilize advanced Claude reasoning to understand complex market nuances and human psychology.",
    tags: ["Context Injection", "Mood Mapping"],
  },
  {
    step: "02",
    label: "Generate",
    title: "Suno & ElevenLabs Media",
    description:
      "Full-stack content production. From cinematic visuals to mastered voiceovers — automatically compiled and brand-aligned.",
    tags: ["Neural Video", "Audio Synth"],
  },
  {
    step: "03",
    label: "Publish",
    title: "Omni-Channel Auto-Post",
    description:
      "One click to global presence. Auto-posting to YouTube, TikTok, and Instagram with real-time feedback loop integration.",
    tags: ["API Hooks", "Analytics Sync"],
  },
] as const;

const CHARACTERS = [
  {
    initials: "LR",
    name: "Luna Rivers",
    role: "Indie Architect",
    quote:
      "Creating bridges between underground culture and mainstream consciousness.",
    stats: [
      { label: "Followers", value: "42.1K" },
      { label: "ER Rate", value: "8.4%" },
      { label: "Uptime", value: "99.2%" },
    ],
  },
  {
    initials: "DC",
    name: "Devon Code",
    role: "Tech Sentinel",
    quote:
      "Translating complex innovation into actionable intelligence for the next generation.",
    stats: [
      { label: "Followers", value: "156K" },
      { label: "ER Rate", value: "6.1%" },
      { label: "Uptime", value: "99.8%" },
    ],
  },
] as const;

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <Header />

      <main className="pt-24">
        {/* ─── HERO ─── */}
        <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 lg:px-24">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />

          <div className="relative z-10 grid w-full max-w-360 items-center gap-24 lg:grid-cols-2">
            <div className="space-y-12">
              <div className="space-y-6">
                <MonoLabel size="md" color="primary" className="tracking-[0.3em]">
                  Zero Friction Onboarding
                </MonoLabel>
                <h1 className="font-display text-6xl font-extrabold uppercase leading-[1.05] tracking-[-0.04em] md:text-8xl">
                  Wake Your <br />
                  <span className="text-primary text-glow-amber">
                    Digital Empire
                  </span>{" "}
                  With One URL.
                </h1>
                <p className="max-w-xl text-xl leading-relaxed text-[--ph-text-secondary]">
                  Paste your website or social profile. Our AI instantly learns
                  your brand DNA and deploys your autonomous marketing team.
                </p>
              </div>

              <div className="max-w-xl space-y-4">
                <UrlHeroInput />
                <MonoLabel size="xs" color="faint">
                  * Instant Analysis &amp; Character Mapping Enabled
                </MonoLabel>
              </div>
            </div>

            {/* Right: Monolith + Floating Cards */}
            <div className="relative hidden h-[600px] lg:block">
              <div
                className="absolute bottom-0 left-1/2 h-96 w-64 -translate-x-1/2 rounded-t-full border-x border-t border-primary/20 backdrop-blur-sm shadow-[0_-40px_100px_rgba(245,158,11,0.1)]"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(245,158,11,0.1) 0%, rgba(245,158,11,0) 100%)",
                }}
              />
              <CharacterFloatCard
                initials="LR"
                name="Luna Rivers"
                role="Indie Artist"
                progressValue={92}
                className="absolute left-0 top-10 -rotate-6 translate-y-12"
              />
              <CharacterFloatCard
                initials="DC"
                name="Devon Code"
                role="Tech Influencer"
                progressValue={88}
                className="absolute right-0 top-40 rotate-3 -translate-y-8"
              />
            </div>
          </div>
        </section>

        {/* ─── FEATURES: ASYMMETRIC GRID ─── */}
        <section id="engines" className="mx-auto max-w-360 px-12 py-32">
          <div className="grid gap-16 md:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className={`group space-y-8 ${f.stagger}`}>
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-primary/10 bg-[--ph-surface-200] transition-colors group-hover:bg-[--ph-accent-muted]">
                  <f.icon className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="mb-4 font-display text-3xl font-bold">
                    {f.title}
                  </h3>
                  <p className="leading-relaxed text-foreground/60">
                    {f.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── INTELLIGENCE LIFECYCLE ─── */}
        <section id="lifecycle" className="bg-[--ph-bg-shell]/30 px-12 py-32">
          <div className="mx-auto max-w-360">
            <div className="mb-24 flex flex-col justify-between gap-8 md:flex-row md:items-end">
              <h2 className="max-w-lg font-display text-5xl font-extrabold uppercase leading-none">
                The Intelligence <br /> Lifecycle
              </h2>
              <MonoLabel
                size="md"
                color="info"
                className="border-b border-[--ph-info]/30 pb-2"
              >
                Process v3.0
              </MonoLabel>
            </div>

            <div className="grid gap-0 lg:grid-cols-3">
              {LIFECYCLE.map((phase, i) => (
                <div
                  key={phase.step}
                  className={`group relative overflow-hidden border-l border-border/10 p-12 ${i === LIFECYCLE.length - 1 ? "border-r" : ""}`}
                >
                  <span className="pointer-events-none absolute -left-6 -top-10 select-none font-display text-[10rem] font-black leading-none opacity-5">
                    {phase.step}
                  </span>
                  <div className="relative z-10">
                    <MonoLabel
                      size="md"
                      color="primary"
                      className="mb-6 block"
                    >
                      {phase.label}
                    </MonoLabel>
                    <h3 className="mb-6 font-display text-3xl font-bold">
                      {phase.title}
                    </h3>
                    <p className="mb-8 text-foreground/60">
                      {phase.description}
                    </p>
                    <div className="flex gap-2">
                      {phase.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-sm bg-[--ph-surface-250] px-3 py-1 font-mono text-[10px] uppercase"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CHARACTER SHOWCASE ─── */}
        <section className="overflow-hidden px-12 py-32">
          <div className="mx-auto max-w-360">
            <div className="mb-24 text-center">
              <h2 className="font-display text-5xl font-extrabold uppercase tracking-tighter md:text-6xl">
                Engineered For{" "}
                <span className="text-primary">Connection</span>
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-[--ph-text-secondary]/70">
                Meet the digital architects of your new empire. Each character
                is a self-sustaining entity with unique goals and values.
              </p>
            </div>

            <div className="flex flex-col justify-center gap-8 md:flex-row">
              {CHARACTERS.map((char) => (
                <CharacterShowcaseCard key={char.initials} {...char} />
              ))}
            </div>
          </div>
        </section>

        {/* ─── SOCIAL PROOF ─── */}
        <section className="border-t border-border px-12 py-20">
          <div className="mx-auto max-w-360 text-center">
            <MonoLabel size="xs" color="faint" className="mb-12 block">
              Built for modern marketing teams
            </MonoLabel>
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {[
                { value: "12", label: "Content Dimensions" },
                { value: "24/7", label: "Autonomous Optimization" },
                { value: "10x", label: "Creative Output" },
                { value: "90%+", label: "Hands-Free Ops" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="font-display text-4xl font-extrabold tracking-tight">
                    {stat.value}
                  </p>
                  <MonoLabel size="xs" color="faint" className="mt-2">
                    {stat.label}
                  </MonoLabel>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FINAL CTA ─── */}
        <section className="relative overflow-hidden px-12 py-48">
          <div className="pointer-events-none absolute inset-0 bg-primary/5 blur-[150px]" />
          <div className="relative z-10 mx-auto max-w-3xl text-center">
            <h2 className="font-display text-4xl font-extrabold uppercase tracking-tight md:text-5xl">
              Ready to wake your empire?
            </h2>
            <p className="mx-auto mt-6 max-w-md text-lg text-[--ph-text-secondary]">
              Join businesses that replaced their marketing busywork with an AI
              engine that works 24/7.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/auth"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-linear-to-br from-primary to-[--ph-amber-600] px-8 py-4 text-lg font-display font-bold text-primary-foreground shadow-[0_8px_16px_rgba(245,158,11,0.2)] transition-all duration-200 hover:brightness-110 hover:scale-[0.98] active:scale-[0.95]"
              >
                Get Started Free
              </Link>
              <Button asChild variant="outline" size="lg" className="text-lg">
                <Link href="/pricing">View Pricing</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
