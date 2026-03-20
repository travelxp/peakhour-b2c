import Link from "next/link";
import { Check, Minus, Zap } from "lucide-react";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { MonoLabel } from "@/components/ui/mono-label";
import { PulsingStatusBadge } from "@/components/ui/pulsing-status-badge";
import { GradientButton } from "@/components/ui/gradient-button";
import { StatBlock } from "@/components/ui/stat-block";

const PLANS = [
  {
    name: "Starter Neural",
    description: "For visionaries initiating their first cognitive cycles.",
    price: "$490",
    cycle: "Per Neural Cycle",
    features: [
      "24h Learning Velocity",
      "Standard Node Access",
      "Single Channel Synthesis",
    ],
    cta: "Initiate Starter",
    highlighted: false,
    useBolt: false,
  },
  {
    name: "Growth Engine",
    description: "Accelerated intelligence for scaling operations.",
    price: "$1,250",
    cycle: "Per Neural Cycle",
    badge: "Optimal Flow",
    features: [
      "Real-time Learning Velocity",
      "Expanded Node Priority",
      "Cross-Channel Synthesis",
      "Custom Brand DNA",
    ],
    cta: "Initiate Pulse",
    highlighted: true,
    useBolt: true,
  },
  {
    name: "Enterprise Intelligence",
    description: "Infinite cognitive scale for global ecosystems.",
    price: "Custom",
    cycle: "Tailored Architecture",
    features: [
      "Predictive Learning Velocity",
      "Dedicated Neural Nodes",
      "Omni-Channel Synthesis",
      "24/7 Cognitive Support",
    ],
    cta: "Connect Architect",
    highlighted: false,
    useBolt: false,
  },
] as const;

const COMPARISON: {
  feature: string;
  sub: string;
  starter: string | boolean | null;
  growth: string | boolean;
  enterprise: string | boolean;
}[] = [
  {
    feature: "Autonomous Learning Velocity",
    sub: "The speed at which the model re-trains on new data.",
    starter: "24 Hours",
    growth: "Real-Time",
    enterprise: "Predictive",
  },
  {
    feature: "Neural Node Access",
    sub: "Dedicated compute clusters for inference tasks.",
    starter: "Shared (10)",
    growth: "Priority (50)",
    enterprise: "Isolated (Custom)",
  },
  {
    feature: "Cross-Channel Synthesis",
    sub: "Unifying insights across disparate data streams.",
    starter: "Limited",
    growth: "Full Spectrum",
    enterprise: "Unlimited",
  },
  {
    feature: "Custom Brand DNA Tuning",
    sub: "Fine-tuning the model to mirror your brand's unique voice.",
    starter: null,
    growth: true,
    enterprise: true,
  },
];

const FAQ = [
  {
    q: "How does the AI maintain data security during learning?",
    a: "All training happens within isolated neural containers. Your data is encrypted at rest and in transit, and we employ differential privacy techniques to ensure your unique brand DNA is never leaked into the global model.",
  },
  {
    q: "Can I switch tiers mid-cycle?",
    a: "Yes. Upgrades take effect immediately with prorated billing. Downgrades apply at the start of your next Neural Cycle.",
  },
  {
    q: 'What constitutes a "Neural Node"?',
    a: "A Neural Node is a dedicated compute cluster assigned to your AI characters. More nodes mean faster processing, more concurrent content generation, and higher throughput across channels.",
  },
  {
    q: 'How is "Learning Velocity" measured?',
    a: "Learning Velocity measures the speed at which the model re-trains on new data from your connected platforms. Real-time means continuous learning; 24h means daily batch processing.",
  },
] as const;

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="pt-24">
        {/* ─── HERO ─── */}
        <section className="px-8 py-24">
          <div className="mx-auto grid max-w-7xl items-end gap-12 md:grid-cols-3">
            <div className="md:col-span-2">
              <MonoLabel size="md" color="primary">
                Neural Investment
              </MonoLabel>
              <h1 className="mt-4 font-display text-5xl font-bold leading-tight tracking-tight md:text-6xl">
                Choose Your Cognitive Architecture
              </h1>
            </div>
            <div className="flex justify-end">
              <PulsingStatusBadge label="Neural Pulse Active" variant="ping" />
            </div>
          </div>
        </section>

        {/* ─── PRICING CARDS ─── */}
        <section className="px-8 pb-32">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-12">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl p-10 md:col-span-4 ${
                  plan.highlighted
                    ? "relative overflow-hidden bg-[--ph-surface-950] text-white shadow-2xl"
                    : "bg-[--ph-bg-card] transition-transform duration-300 hover:-translate-y-1"
                }`}
              >
                {plan.highlighted && "badge" in plan && (
                  <div className="absolute right-6 top-6 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
                    {plan.badge}
                  </div>
                )}

                <div className="mb-12">
                  <h3 className="font-display text-2xl font-bold">{plan.name}</h3>
                  <p className={`mt-2 ${plan.highlighted ? "opacity-80" : "text-muted-foreground"}`}>
                    {plan.description}
                  </p>
                </div>

                <div className="mb-12">
                  <div className="font-display text-5xl font-bold">{plan.price}</div>
                  <div className={`mt-1 text-sm uppercase tracking-wider ${plan.highlighted ? "opacity-60" : "text-muted-foreground"}`}>
                    {plan.cycle}
                  </div>
                </div>

                <ul className="mb-12 space-y-4">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm">
                      {plan.useBolt ? (
                        <Zap className="h-4 w-4 shrink-0 fill-primary text-primary" />
                      ) : (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      )}
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/auth"
                  className={`block w-full rounded-md py-4 text-center font-bold transition-colors ${
                    plan.highlighted
                      ? "bg-linear-to-r from-primary to-[--ph-amber-600] text-primary-foreground hover:opacity-90"
                      : "border border-border hover:bg-foreground hover:text-background"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* ─── FEATURE COMPARISON TABLE ─── */}
        <section className="mx-auto mb-32 max-w-7xl px-8">
          <h2 className="mb-12 font-display text-4xl font-bold tracking-tight">
            Autonomous Feature Comparison
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border/10 bg-[--ph-bg-card] shadow-sm">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border/20 bg-[--ph-bg-shell]">
                  <th className="p-8 font-display text-lg font-bold">Intelligence Vector</th>
                  <th className="p-8 font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">Starter</th>
                  <th className="p-8 font-display text-sm font-semibold uppercase tracking-widest text-primary">Growth</th>
                  <th className="p-8 font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.feature} className="border-b border-border/10">
                    <td className="p-8">
                      <span className="block font-bold">{row.feature}</span>
                      <span className="text-xs text-muted-foreground">{row.sub}</span>
                    </td>
                    <td className="p-8 text-sm text-muted-foreground">
                      {row.starter === null ? <Minus className="h-4 w-4 text-muted-foreground/40" /> : row.starter === true ? <Check className="h-4 w-4 text-primary" /> : row.starter}
                    </td>
                    <td className="p-8 text-sm font-bold text-foreground">
                      {row.growth === true ? <Check className="h-4 w-4 text-primary" /> : row.growth}
                    </td>
                    <td className="p-8 text-sm text-muted-foreground">
                      {row.enterprise === true ? <Check className="h-4 w-4 text-primary" /> : row.enterprise}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ─── THE EXPANSION MODEL ─── */}
        <section className="mx-auto mb-32 max-w-7xl px-8">
          <div className="relative overflow-hidden rounded-3xl bg-[--ph-surface-250] p-12 md:p-20">
            {/* Decorative bg */}
            <div className="absolute right-0 top-0 h-full w-1/3 opacity-10">
              <div className="h-full w-full bg-linear-to-l from-primary/20 to-transparent" />
            </div>
            <div className="relative z-10 max-w-2xl">
              <h2 className="font-display text-5xl font-bold leading-tight">
                The Expansion Model
              </h2>
              <p className="mt-8 text-xl text-muted-foreground">
                We believe in{" "}
                <span className="font-bold text-foreground">Cognitive Alignment</span>.
                Peakhour.ai doesn&apos;t charge for seats you don&apos;t use. You pay for
                performance — the actual output and intelligence synthesized by
                the engine.
              </p>
              <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2">
                <StatBlock
                  label="Inference Cost"
                  value="0.001%"
                  description="Inference cost per token. Minimal barrier to entry, maximum ceiling for growth."
                  valueSize="lg"
                />
                <StatBlock
                  label="Scaling Capacity"
                  value="Infinite"
                  description="Scaling capacity. Our distributed nodes expand automatically as your data grows."
                  valueSize="lg"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section className="mx-auto mb-32 max-w-4xl px-8">
          <h2 className="mb-12 text-center font-display text-4xl font-bold">
            The Cognitive Brief
          </h2>
          <div className="space-y-4">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group overflow-hidden rounded-xl bg-[--ph-bg-shell]"
              >
                <summary className="flex w-full cursor-pointer items-center justify-between px-8 py-6 text-left font-display font-bold transition-colors hover:text-primary [&::-webkit-details-marker]:hidden list-none">
                  {item.q}
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </summary>
                <div className="px-8 pb-6 text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* ─── BOTTOM CTA ─── */}
        <section className="mx-auto mb-32 max-w-7xl px-8">
          <div className="rounded-[3rem] bg-primary p-16 text-center md:p-24">
            <h2 className="font-display text-4xl font-bold text-primary-foreground md:text-5xl">
              Ready to synchronize?
            </h2>
            <p className="mx-auto mt-6 max-w-lg text-primary-foreground/70">
              Join the next evolution of autonomous marketing intelligence.
              Start your Neural Cycle today.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link href="/auth">
                <GradientButton
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/30 bg-[--ph-surface-0] text-foreground hover:bg-[--ph-surface-100] hover:text-foreground"
                >
                  Initiate Neural Pulse
                </GradientButton>
              </Link>
              <Link href="/contact">
                <GradientButton
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                >
                  Talk to an Architect
                </GradientButton>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
