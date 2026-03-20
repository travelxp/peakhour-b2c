import Link from "next/link";
import { Brain, Rocket, BarChart2, PlayCircle, Shield, Zap } from "lucide-react";
import { MonoLabel } from "@/components/ui/mono-label";
import { CharacterFloatCard } from "@/components/ui/character-float-card";
import { CharacterShowcaseCard } from "@/components/ui/character-showcase-card";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";

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
      "Inject your brand DNA. Our characters utilize advanced Claude-3-Opus reasoning to understand complex market nuances and human psychology.",
    tags: ["Context Injection", "Mood Mapping"],
  },
  {
    step: "02",
    label: "Generate",
    title: "Suno & ElevenLabs Media",
    description:
      "Full-stack content production. From Runway-powered cinematic visuals to ElevenLabs-mastered voiceovers — automatically compiled.",
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
    role: "The Indie Architect",
    quote:
      "Creating resonance in the noise through aesthetic precision and acoustic storytelling.",
    stats: [
      { label: "Followers", value: "1.2M" },
      { label: "ER Rate", value: "4.8%" },
      { label: "Uptime", value: "24/7" },
    ],
  },
  {
    initials: "DC",
    name: "Devon Code",
    role: "The Tech Sentinel",
    quote:
      "Synthesizing complex technical paradigms into actionable future-forward narratives.",
    stats: [
      { label: "Subscribers", value: "890K" },
      { label: "Trust Index", value: "High" },
      { label: "Logic Grade", value: "A+" },
    ],
  },
] as const;

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <Header />

      <main>
        {/* ─── HERO ─── */}
        <section className="relative flex h-screen min-h-[600px] items-center justify-center overflow-hidden px-6 lg:px-24">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />

          <div className="relative z-10 grid w-full max-w-360 items-center gap-12 lg:grid-cols-2">
            <div className="space-y-8">
              <div className="space-y-4">
                <MonoLabel size="xs" color="primary" className="tracking-[0.3em]">
                  Autonomous Marketing 2.0
                </MonoLabel>
                <h1 className="font-display text-4xl font-extrabold uppercase leading-[1.1] tracking-[-0.04em] md:text-6xl">
                  The Entire <br />
                  <span className="text-primary text-glow-amber">
                    Marketing Lifecycle
                  </span>
                  , <br />
                  Powered by One URL.
                </h1>
                <p className="max-w-xl text-lg leading-relaxed text-[--ph-text-secondary] opacity-90">
                  From social and newsletters to high-performance ads. Deploy
                  autonomous AI characters that learn your brand, create your
                  content, and grow your business across every channel 24/7.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <Link
                  href="/auth"
                  className="rounded-lg bg-primary px-8 py-3.5 text-base font-bold text-primary-foreground transition-all duration-200 ease-out hover:brightness-110 hover:scale-95"
                >
                  Deploy Your First Character
                </Link>
                <Link
                  href="#lifecycle"
                  className="flex items-center gap-3 rounded-lg border border-[--ph-surface-400] bg-[--ph-surface-100] px-8 py-3.5 text-base font-bold text-foreground transition-all duration-200 hover:bg-[--ph-surface-250]"
                >
                  <PlayCircle className="h-5 w-5 fill-current" />
                  Watch the Demo
                </Link>
              </div>
            </div>

            {/* Right: Monolith + Floating Cards */}
            <div className="relative hidden h-[500px] lg:block">
              <div
                className="absolute bottom-0 left-1/2 h-80 w-56 -translate-x-1/2 rounded-t-full border-x border-t border-primary/20 backdrop-blur-sm shadow-[0_-40px_100px_rgba(245,158,11,0.1)]"
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
                className="absolute left-0 top-10 w-56 -rotate-6 translate-y-8"
              />
              <CharacterFloatCard
                initials="DC"
                name="Devon Code"
                role="Tech Influencer"
                progressValue={88}
                className="absolute right-0 top-32 w-56 rotate-3 -translate-y-4"
              />
            </div>
          </div>
        </section>

        {/* ─── FEATURES: ASYMMETRIC GRID ─── */}
        <section id="engines" className="mx-auto max-w-360 px-12 py-24">
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

        {/* ─── ENTERPRISE SECTION ─── */}
        <section className="border-t border-border/10 px-12 py-32">
          <div className="mx-auto max-w-360 text-center">
            <MonoLabel size="md" color="faint" className="mb-16 block tracking-[0.4em]">
              Trusted by the Future-First
            </MonoLabel>

            <div className="mx-auto mb-24 grid max-w-4xl gap-12 md:grid-cols-2">
              <div className="rounded-xl border border-white/5 bg-[--ph-bg-shell] p-10 text-left">
                <Shield className="mb-6 h-6 w-6 text-primary" />
                <h4 className="mb-4 font-display text-xl font-bold">
                  Enterprise Security
                </h4>
                <p className="text-sm leading-relaxed text-foreground/50">
                  SOC-2 Type II compliant with end-to-end data encryption. Your
                  character&apos;s unique identity is your IP, protected by
                  neural-vault technology.
                </p>
              </div>
              <div className="rounded-xl border border-white/5 bg-[--ph-bg-shell] p-10 text-left">
                <Zap className="mb-6 h-6 w-6 text-primary" />
                <h4 className="mb-4 font-display text-xl font-bold">
                  Vercel-Native Performance
                </h4>
                <p className="text-sm leading-relaxed text-foreground/50">
                  Edge-computed responses ensuring zero latency across global
                  delivery networks. Built for high-availability marketing
                  demands.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FINAL CTA ─── */}
        <section className="relative overflow-hidden px-12 py-48">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-primary/5 blur-[150px]" />
          <div className="mx-auto max-w-4xl space-y-12 text-center">
            <h2 className="font-display text-5xl font-extrabold uppercase leading-none tracking-tighter md:text-7xl">
              Your Empire is <br />
              <span className="text-primary text-glow-amber">
                Waiting to Wake.
              </span>
            </h2>
            <p className="text-xl text-[--ph-text-secondary]/60">
              Join the waitlist for private beta access or deploy your first
              autonomous agent today.
            </p>
            <div className="flex flex-col items-center justify-center gap-6 pt-8 md:flex-row">
              <input
                type="email"
                placeholder="Enter your work email"
                className="w-full rounded border border-border/30 bg-[--ph-surface-100] px-8 py-4 outline-none transition-all placeholder:text-foreground/30 focus:border-transparent focus:ring-2 focus:ring-primary md:w-96"
              />
              <Link
                href="/auth"
                className="rounded bg-primary px-10 py-4 font-bold text-primary-foreground transition-all hover:brightness-110"
              >
                Get Early Access
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
