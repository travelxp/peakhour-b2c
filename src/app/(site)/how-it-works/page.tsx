import Link from "next/link";
import {
  ArrowRight,
  ArrowDown,
  Brain,
  Check,
  MapPin,
  MessageSquare,
  PenLine,
  Plug,
  Radar,
  ShoppingBag,
  SlidersHorizontal,
  TrendingUp,
  Waypoints,
  Wind,
  Zap,
} from "lucide-react";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { Reveal, RevealNoScript } from "@/components/marketing/reveal";
import { pageMetadata } from "@/lib/seo";
import { getPublicCatalog, signupCta } from "@/lib/catalog";
import { HOW_IT_WORKS_STEPS } from "@/lib/how-it-works";
import {
  CONNECTED_SIGNALS,
  CONTROL_SPLIT,
  NEXT_ACTIONS,
  PLATFORM_FLOW,
  RELIEF_LINES,
  SCATTERED_TOOLS,
  UNDERSTANDS,
} from "@/lib/how-peakhour-works";

export const metadata = pageMetadata({
  title: "See how Peakhour works — one intelligence layer for your whole business",
  description:
    "Peakhour connects to the tools you already use, understands your business automatically, and connects signals across sales, content, marketing, support and presence — so the next action comes to you instead of you hunting for it.",
  path: "/how-it-works",
});

/** Icon per flow step — keyed on the step id so the two lists can't drift. */
const FLOW_ICONS: Record<(typeof PLATFORM_FLOW)[number]["id"], typeof Plug> = {
  connect: Plug,
  understand: Brain,
  "connect-dots": Waypoints,
  find: Radar,
  act: Zap,
  less: Wind,
};

/**
 * The five pillars, in brand order. Used by the before/after diagram and the
 * next-action rows — the point being made there is that these five stop being
 * five separate products once they share one layer.
 */
const PILLAR_MARKS = [
  { name: "Commerce", icon: ShoppingBag },
  { name: "Content", icon: PenLine },
  { name: "Growth", icon: TrendingUp },
  { name: "Support", icon: MessageSquare },
  { name: "Presence", icon: MapPin },
] as const;

const PILLAR_ICON: Record<string, typeof ShoppingBag> = Object.fromEntries(
  PILLAR_MARKS.map((p) => [p.name, p.icon]),
);

/** Shared eyebrow — uppercase gold label over the short gradient rule. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-label">
      <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
      {children}
    </span>
  );
}

export default async function HowItWorks() {
  const catalog = await getPublicCatalog();
  const cta = signupCta(catalog?.platform?.signupMode ?? "open");

  return (
    <div className="flex min-h-screen flex-col">
      <RevealNoScript />
      <Header />
      <main>
        {/* ── Hero ─────────────────────────────────────────────────────
            The whole argument in one sentence, then the picture that
            proves it. Everything below is elaboration. */}
        <section className="pt-12 pb-14 sm:pt-16 sm:pb-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <Eyebrow>How Peakhour works</Eyebrow>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-pretty sm:text-5xl lg:text-6xl">
                Most tools show you one channel.{" "}
                <span className="font-serif font-normal italic text-brand-gradient">
                  Peakhour connects the whole business.
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
                Connect the tools you already run on. Peakhour learns how your
                business actually works, links what is happening across every
                part of it, and brings you the next thing worth doing — from one
                place.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                {!cta.disabled && (
                  <Link
                    href={cta.href}
                    className="group inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-6 py-3.5 text-sm font-bold text-brand-contrast shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 motion-reduce:transition-none"
                  >
                    {cta.label}
                    <ArrowRight
                      className="size-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
                      aria-hidden
                    />
                  </Link>
                )}
                <Link
                  href="/pricing"
                  className="inline-flex items-center rounded-xl border-2 px-6 py-3 text-sm font-bold transition-colors hover:border-brand hover:text-brand"
                >
                  See pricing
                </Link>
              </div>
            </div>

            {/* Before / after — the single most important picture on the page.
                Left: five products that each only know their own corner.
                Right: the same five wired into one layer. */}
            <Reveal className="mt-14 grid gap-4 lg:mt-16 lg:grid-cols-2 lg:gap-6">
              {/* Today */}
              <div className="rounded-3xl border border-dashed bg-muted/30 p-6 sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Most tools
                </p>
                <p className="mt-2 text-lg font-bold tracking-tight">
                  Five products. Five separate views.
                </p>
                <div className="mt-7 grid grid-cols-5 gap-1.5 sm:gap-3">
                  {PILLAR_MARKS.map((p) => {
                    const Icon = p.icon;
                    return (
                      <div key={p.name} className="flex flex-col items-center gap-2">
                        <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-dashed bg-background text-muted-foreground">
                          <Icon className="size-4 sm:size-5" strokeWidth={1.75} aria-hidden />
                        </div>
                        <span className="text-center text-[0.6rem] font-semibold leading-tight text-muted-foreground sm:text-xs">
                          {p.name}
                        </span>
                        {/* A stub that goes nowhere — the visual point of this
                            half of the diagram. */}
                        <span className="h-6 w-px bg-border sm:h-8" aria-hidden />
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 border-t border-dashed pt-4 text-sm text-muted-foreground">
                  Each one only knows its own corner. Joining them up is your job
                  — every morning, across every tab.
                </p>
              </div>

              {/* With Peakhour */}
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 p-6 text-zinc-100 shadow-2xl sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
                  With Peakhour
                </p>
                <p className="mt-2 text-lg font-bold tracking-tight">
                  The same five, sharing one brain.
                </p>
                <div className="mt-7 grid grid-cols-5 gap-1.5 sm:gap-3">
                  {PILLAR_MARKS.map((p) => {
                    const Icon = p.icon;
                    return (
                      <div key={p.name} className="flex flex-col items-center gap-2">
                        <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-brand/40 bg-brand/10 text-brand">
                          <Icon className="size-4 sm:size-5" strokeWidth={1.75} aria-hidden />
                        </div>
                        <span className="text-center text-[0.6rem] font-semibold leading-tight text-zinc-300 sm:text-xs">
                          {p.name}
                        </span>
                        {/* Gold lead-in — every pillar runs into the bar below. */}
                        <span className="h-6 w-px bg-brand/60 sm:h-8" aria-hidden />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-brand-gradient px-4 py-3 text-center text-sm font-bold text-brand-contrast">
                  <Waypoints className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
                  One Peakhour intelligence layer
                </div>
                <p className="mt-4 text-sm text-zinc-400">
                  Because they share it, each part of your business can inform
                  the others — automatically, without you carrying the context
                  between them.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── The flow ─────────────────────────────────────────────────
            Six steps down a gold spine, with a pulse travelling it. */}
        <section className="border-t bg-muted/30 py-14 sm:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <Reveal className="max-w-2xl">
              <Eyebrow>End to end</Eyebrow>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">
                From plugging it in to{" "}
                <span className="font-serif font-normal italic text-brand-gradient">
                  having less on your plate.
                </span>
              </h2>
            </Reveal>

            <ol className="relative mt-12 flex flex-col gap-8 sm:gap-10">
              {/* The spine. Sits behind the numbered nodes, stopping level with
                  the last one so it doesn't trail past the final card. */}
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-10 left-6 top-6 w-px overflow-hidden bg-linear-to-b from-brand/70 via-brand/40 to-transparent sm:left-7"
              >
                <span className="flow-spine-pulse absolute inset-x-0 -top-16 h-16 animate-[flow-spine-pulse_5s_linear_infinite] bg-linear-to-b from-transparent via-brand to-transparent" />
              </span>

              {PLATFORM_FLOW.map((s, i) => {
                const Icon = FLOW_ICONS[s.id];
                return (
                  <Reveal
                    as="li"
                    key={s.id}
                    // Small stagger only — six items at 80ms each still land
                    // inside half a second of the section coming into view.
                    delay={Math.min(i, 3) * 80}
                    className="relative grid grid-cols-[3rem_1fr] items-start gap-4 sm:grid-cols-[3.5rem_1fr] sm:gap-6"
                  >
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-gradient shadow-lg shadow-brand/20 sm:size-14">
                      <Icon className="size-5 text-brand-contrast sm:size-6" strokeWidth={2} aria-hidden />
                    </div>
                    <div className="pt-1">
                      <p
                        className="text-xs font-bold uppercase tracking-[0.2em] text-brand-label"
                        aria-hidden
                      >
                        {s.step}
                      </p>
                      <h3 className="mt-1.5 text-xl font-bold tracking-tight sm:text-2xl">
                        {s.title}
                      </h3>
                      <p className="mt-2 max-w-xl text-muted-foreground">
                        {s.description}
                      </p>
                    </div>
                  </Reveal>
                );
              })}
            </ol>
          </div>
        </section>

        {/* ── What it understands ──────────────────────────────────────
            Step 02 made concrete: the eleven things you'd otherwise have
            to explain to a new hire. */}
        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 p-8 text-zinc-100 shadow-2xl sm:p-12">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand">
                  <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
                  After you connect
                </span>
                <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">
                  You don&rsquo;t brief it.{" "}
                  <span className="font-serif font-normal italic text-brand-gradient">
                    It reads the business.
                  </span>
                </h2>
                <p className="mt-4 text-zinc-400">
                  No onboarding questionnaire, no brand deck, no spreadsheet of
                  products to upload. Within minutes of connecting, Peakhour has
                  picked up:
                </p>
              </div>
              <ul className="mt-9 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {UNDERSTANDS.map((item, i) => (
                  <Reveal
                    as="li"
                    key={item}
                    delay={Math.min(i, 5) * 60}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/4 px-4 py-3 text-sm font-medium transition-colors hover:border-brand/50"
                  >
                    <Check className="size-4 shrink-0 text-brand" strokeWidth={2.5} aria-hidden />
                    {item}
                  </Reveal>
                ))}
              </ul>
              <p className="mt-7 border-t border-white/10 pt-6 text-sm text-zinc-400">
                All of it read from what you already have — not guessed from your
                business name.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ── Connected signals ────────────────────────────────────────
            The payoff of the shared layer: something noticed over here
            changes what you should do over there. */}
        <section className="border-t bg-muted/30 py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="max-w-2xl">
              <Eyebrow>Connecting the dots</Eyebrow>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">
                One thing happens here.{" "}
                <span className="font-serif font-normal italic text-brand-gradient">
                  It changes what you do there.
                </span>
              </h2>
              <p className="mt-4 text-muted-foreground">
                None of these are things a single tool can see, because none of
                them happen in a single tool.
              </p>
            </Reveal>

            <div className="mt-11 grid gap-4 lg:grid-cols-2">
              {CONNECTED_SIGNALS.map((s, i) => {
                const FromIcon = PILLAR_ICON[s.from];
                const ToIcon = PILLAR_ICON[s.to];
                return (
                  <Reveal
                    key={s.id}
                    delay={Math.min(i, 3) * 70}
                    className={
                      "group flex flex-col gap-4 rounded-2xl border bg-background p-6 transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-brand/50 hover:shadow-lg hover:shadow-brand/15 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-7 " +
                      // The last card is alone on the final row at lg — let it
                      // span so the grid doesn't end on a half-empty line.
                      (i === CONNECTED_SIGNALS.length - 1 &&
                      CONNECTED_SIGNALS.length % 2 === 1
                        ? "lg:col-span-2"
                        : "")
                    }
                  >
                    {/* Route chip — the two parts of the business being joined. */}
                    <div className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-brand-ink">
                        {FromIcon && <FromIcon className="size-3" strokeWidth={2.5} aria-hidden />}
                        {s.from}
                      </span>
                      <ArrowRight className="size-3.5 shrink-0 text-brand" strokeWidth={2.5} aria-hidden />
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-brand-ink">
                        {ToIcon && <ToIcon className="size-3" strokeWidth={2.5} aria-hidden />}
                        {s.to}
                      </span>
                    </div>

                    <p className="text-lg font-bold leading-snug tracking-tight">
                      {s.signal}
                    </p>
                    <p className="flex gap-2.5 font-serif text-base italic leading-relaxed text-muted-foreground">
                      <ArrowDown className="mt-1 size-4 shrink-0 text-brand" strokeWidth={2.5} aria-hidden />
                      {s.connection}
                    </p>
                    <p className="mt-auto flex items-start gap-2.5 rounded-xl border border-brand/25 bg-brand/6 px-4 py-3 text-sm font-semibold">
                      <Zap className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2.5} aria-hidden />
                      {s.suggestion}
                    </p>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Next actions come to you ─────────────────────────────────
            The daily experience: stop opening six dashboards to find out
            what needs attention. */}
        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="max-w-2xl">
              <Eyebrow>Your morning</Eyebrow>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">
                Stop opening six dashboards to work out{" "}
                <span className="font-serif font-normal italic text-brand-gradient">
                  what needs you today.
                </span>
              </h2>
            </Reveal>

            <div className="mt-11 grid items-start gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-10">
              {/* Before: the scatter. */}
              <Reveal>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Today
                </p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {SCATTERED_TOOLS.map((tool) => (
                    <li
                      key={tool}
                      className="rounded-lg border border-dashed px-3 py-2 text-sm font-medium text-muted-foreground"
                    >
                      {tool}
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-muted-foreground">
                  Eight tabs, eight partial answers, and a nagging sense that the
                  thing that actually matters is in the one you didn&rsquo;t
                  open.
                </p>
              </Reveal>

              {/* After: the panel. Illustrative, so it is one picture to a
                  screen reader — the "buttons" are styled spans with no
                  behaviour, exactly like the landing hero's pillar console. */}
              <Reveal delay={120}>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-label">
                  With Peakhour
                </p>
                <div
                  className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 p-4 shadow-2xl sm:p-5"
                  role="img"
                  aria-label="Peakhour bringing four suggested next actions to the founder, each drawn from a different part of the business"
                >
                  <div className="flex items-center justify-between px-1 pb-3 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-zinc-400">
                    <span>Worth your attention</span>
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden />
                      live
                    </span>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {NEXT_ACTIONS.map((row) => {
                      const Icon = PILLAR_ICON[row.pillar];
                      return (
                        <div
                          key={row.observation}
                          className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-white/10 bg-white/4 px-3.5 py-3 text-sm"
                        >
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brand">
                            {Icon && <Icon className="size-3.5" strokeWidth={2} aria-hidden />}
                          </span>
                          <span className="min-w-0 flex-1 text-zinc-200">
                            &ldquo;{row.observation}&rdquo;
                          </span>
                          <span className="shrink-0 rounded-lg bg-brand-gradient px-3 py-1.5 text-xs font-bold text-brand-contrast">
                            {row.action}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="px-1 pt-4 text-xs text-zinc-400">
                    Illustrative — your list is built from your own business.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Control ──────────────────────────────────────────────────
            The reassurance the whole page has been earning the right to
            make: automation takes the repetition, never the decisions. */}
        <section className="border-t bg-muted/30 py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="max-w-2xl">
              <Eyebrow>You stay in charge</Eyebrow>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">
                Automatic where it&rsquo;s repetitive.{" "}
                <span className="font-serif font-normal italic text-brand-gradient">
                  Yours where it counts.
                </span>
              </h2>
            </Reveal>

            <div className="mt-11 grid gap-4 md:grid-cols-2">
              <Reveal className="rounded-2xl border bg-background p-7">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-brand-gradient shadow-inner">
                    <Zap className="size-4.5 text-brand-contrast" strokeWidth={2.25} aria-hidden />
                  </span>
                  <h3 className="text-lg font-bold tracking-tight">
                    Peakhour just handles
                  </h3>
                </div>
                <ul className="mt-5 flex flex-col gap-3">
                  {CONTROL_SPLIT.automatic.map((item) => (
                    <li key={item} className="flex gap-3 text-sm text-muted-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2.5} aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              </Reveal>

              <Reveal delay={100} className="rounded-2xl border bg-background p-7">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-brand-gradient shadow-inner">
                    <SlidersHorizontal
                      className="size-4.5 text-brand-contrast"
                      strokeWidth={2.25}
                      aria-hidden
                    />
                  </span>
                  <h3 className="text-lg font-bold tracking-tight">You decide</h3>
                </div>
                <ul className="mt-5 flex flex-col gap-3">
                  {CONTROL_SPLIT.yours.map((item) => (
                    <li key={item} className="flex gap-3 text-sm text-muted-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2.5} aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>

            <Reveal className="mt-6 rounded-2xl border border-brand/25 bg-brand/6 px-6 py-5 text-center text-sm font-medium sm:text-base">
              Autonomy is a dial you turn up as trust grows — not a switch you
              flip on day one.
            </Reveal>
          </div>
        </section>

        {/* ── Getting started ──────────────────────────────────────────
            The practical landing: the same three onboarding steps the
            homepage promises, so the two surfaces can't drift. */}
        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="max-w-2xl">
              <Eyebrow>Getting started</Eyebrow>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">
                Your first hour, not your first quarter.
              </h2>
            </Reveal>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {HOW_IT_WORKS_STEPS.map((s, i) => (
                <Reveal
                  key={s.step}
                  delay={i * 90}
                  className="rounded-2xl border bg-background p-7 transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-brand/50 hover:shadow-lg hover:shadow-brand/15 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  <div className="font-serif text-4xl font-normal italic text-brand-gradient" aria-hidden>
                    {s.step}
                  </div>
                  <h3 className="mt-3 text-lg font-bold tracking-tight">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {s.description}
                  </p>
                  <p className="mt-3 border-t pt-3 text-sm text-muted-foreground/80">
                    {s.detail}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Close ────────────────────────────────────────────────────
            What the visitor is actually buying: the relief, not the
            feature list. */}
        <section className="pb-16 sm:pb-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 px-6 py-16 text-center text-zinc-100 shadow-2xl sm:py-20">
              <ul className="mx-auto flex max-w-md flex-col gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                {RELIEF_LINES.map((line, i) => (
                  <Reveal as="li" key={line} delay={i * 140}>
                    {line}
                  </Reveal>
                ))}
              </ul>
              <p className="mx-auto mt-7 max-w-xl font-serif text-3xl font-normal italic text-brand-gradient sm:text-4xl">
                More time to actually build the business.
              </p>
              <p className="mx-auto mt-8 max-w-md border-t border-white/10 pt-8 text-zinc-400">
                Your business already has the signals. Peakhour connects them.
              </p>
              {!cta.disabled && (
                <Link
                  href={cta.href}
                  className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-7 py-3.5 text-sm font-bold text-brand-contrast shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 motion-reduce:transition-none"
                >
                  {cta.label} — all five pillars
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
                    aria-hidden
                  />
                </Link>
              )}
              <p className="mt-5 text-sm text-zinc-400">
                A free plan on every pillar. No credit card.
              </p>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
