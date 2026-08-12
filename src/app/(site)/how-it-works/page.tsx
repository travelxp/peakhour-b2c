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
import { Reveal } from "@/components/marketing/reveal";
import { RevealNoScript } from "@/components/marketing/reveal-noscript";
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
  // Kept under ~160 characters: past that, search engines truncate it and the
  // last clause — which is the actual promise — is what gets cut.
  description:
    "Peakhour connects to the tools you already use, learns how your business runs, and links what happens across it — so the next action comes to you.",
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
                Right: the same five wired into one layer.

                Deliberately NOT wrapped in <Reveal>. On a desktop viewport this
                sits in the first screenful and is a candidate for the LCP
                element; hiding it at opacity 0 until an observer fires would
                delay that metric to buy a fade nobody scrolled to earn. Reveals
                start at the section below, where there is actually a scroll to
                respond to. */}
            <div className="mt-14 grid gap-4 lg:mt-16 lg:grid-cols-2 lg:gap-6">
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
                      // min-w-0 + break-words: `grid-cols-5` tracks are
                      // minmax(0,1fr), so at ~320px each cell is ~43px while
                      // "Commerce" needs ~45px — without these the label
                      // spills out of its cell instead of wrapping.
                      <div key={p.name} className="flex min-w-0 flex-col items-center gap-2">
                        <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-dashed bg-background text-muted-foreground">
                          <Icon className="size-4 sm:size-5" strokeWidth={1.75} aria-hidden />
                        </div>
                        <span className="break-words text-center text-[0.6rem] font-semibold leading-tight text-muted-foreground sm:text-xs">
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
              <div className="overflow-hidden rounded-3xl border border-ink-line bg-ink p-6 text-on-ink shadow-2xl sm:p-8">
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
                      // min-w-0 + break-words: `grid-cols-5` tracks are
                      // minmax(0,1fr), so at ~320px each cell is ~43px while
                      // "Commerce" needs ~45px — without these the label
                      // spills out of its cell instead of wrapping.
                      <div key={p.name} className="flex min-w-0 flex-col items-center gap-2">
                        <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-brand/40 bg-brand/10 text-brand">
                          <Icon className="size-4 sm:size-5" strokeWidth={1.75} aria-hidden />
                        </div>
                        <span className="break-words text-center text-[0.6rem] font-semibold leading-tight text-on-ink-dim sm:text-xs">
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
                <p className="mt-4 text-sm text-on-ink-dim">
                  Because they share it, each part of your business can inform
                  the others — automatically, without you carrying the context
                  between them.
                </p>
              </div>
            </div>
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

            {/* The spine lives on this wrapper, NOT inside the <ol> — an
                ordered list may only contain <li> (plus <script>/<template>),
                so a decorative <span> in there is invalid markup. */}
            <div className="relative mt-12">
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-10 left-6 top-6 w-px overflow-hidden bg-linear-to-b from-brand/70 via-brand/40 to-transparent sm:left-7"
              >
                <span className="flow-spine-pulse absolute inset-x-0 -top-16 h-16 animate-[flow-spine-pulse_5s_linear_infinite] bg-linear-to-b from-transparent via-brand to-transparent" />
              </span>

              <ol className="flex flex-col gap-8 sm:gap-10">
                {PLATFORM_FLOW.map((s, i) => {
                  const Icon = FLOW_ICONS[s.id];
                  return (
                    <Reveal
                      as="li"
                      key={s.id}
                      // Small stagger only — six items at 80ms each still land
                      // inside half a second of the section coming into view.
                      delay={Math.min(i, 3) * 80}
                      // `relative` so the li and its gold icon tile paint ABOVE
                      // the absolutely-positioned spine behind them (positioned
                      // element, later in tree order) — otherwise the line runs
                      // straight through every node.
                      className="relative grid grid-cols-[3rem_1fr] items-start gap-4 sm:grid-cols-[3.5rem_1fr] sm:gap-6"
                    >
                      <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-gradient shadow-lg shadow-brand/20 sm:size-14">
                        <Icon
                          className="size-5 text-brand-contrast sm:size-6"
                          strokeWidth={2}
                          aria-hidden
                        />
                      </div>
                      <div className="pt-1">
                        {/* aria-hidden: the <ol> already numbers these for a
                            screen reader, and "01" read aloud before "1." is
                            just the same fact twice. */}
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
          </div>
        </section>

        {/* ── What it understands ──────────────────────────────────────
            Step 02 made concrete: the eleven things you'd otherwise have
            to explain to a new hire. */}
        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="overflow-hidden rounded-3xl border border-ink-line bg-ink p-8 text-on-ink shadow-2xl sm:p-12">
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
                <p className="mt-4 text-on-ink-dim">
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
                    className="flex items-center gap-3 rounded-xl border border-ink-line bg-white/4 px-4 py-3 text-sm font-medium transition-colors hover:border-brand/50"
                  >
                    <Check className="size-4 shrink-0 text-brand" strokeWidth={2.5} aria-hidden />
                    {item}
                  </Reveal>
                ))}
              </ul>
              <p className="mt-7 border-t border-ink-line pt-6 text-sm text-on-ink-dim">
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
                {/* "Six" here and in the heading above both track the length of
                    SCATTERED_TOOLS — see the warning on that constant. */}
                <p className="mt-5 text-muted-foreground">
                  Six tabs, six partial answers, and a nagging sense that the
                  thing that actually matters is in the one you didn&rsquo;t
                  open.
                </p>
              </Reveal>

              {/* After: the panel.

                  NOT role="img" — the landing hero's pillar console uses that
                  because its rows are pure decoration (invented statuses), but
                  these four rows ARE the argument: they're the concrete
                  examples of what Peakhour brings you instead of a dashboard.
                  Collapsing them into one alt string would hand a screen-reader
                  user a summary of the page's best content instead of the
                  content. So it's a real list, and the styled action chips —
                  which are inert spans, not buttons — get an sr-only prefix so
                  "Create content" doesn't read as a dangling fragment. */}
              <Reveal delay={120}>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-label">
                  With Peakhour
                </p>
                <div className="mt-5 overflow-hidden rounded-2xl border border-ink-line bg-ink p-4 shadow-2xl sm:p-5">
                  <div className="flex items-center justify-between px-1 pb-3 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-on-ink-dim">
                    <span>Worth your attention</span>
                    <span className="flex items-center gap-1.5 text-success">
                      <span className="size-1.5 rounded-full bg-success" aria-hidden />
                      live
                    </span>
                  </div>
                  <ul className="flex flex-col gap-2.5">
                    {NEXT_ACTIONS.map((row) => {
                      const Icon = PILLAR_ICON[row.pillar];
                      return (
                        <li
                          key={row.observation}
                          className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-ink-line bg-white/4 px-3.5 py-3 text-sm"
                        >
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brand">
                            {Icon && <Icon className="size-3.5" strokeWidth={2} aria-hidden />}
                            {/* The pillar is conveyed by icon alone visually —
                                without this the row loses which part of the
                                business it came from. */}
                            <span className="sr-only">{row.pillar}:</span>
                          </span>
                          <span className="min-w-0 flex-1 text-on-ink">
                            &ldquo;{row.observation}&rdquo;
                          </span>
                          <span className="shrink-0 rounded-lg bg-brand-gradient px-3 py-1.5 text-xs font-bold text-brand-contrast">
                            <span className="sr-only">Suggested action: </span>
                            {row.action}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="px-1 pt-4 text-xs text-on-ink-dim">
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
                  {/* NOT aria-hidden (unlike the flow spine's "01", where the
                      <ol> already numbers each item): these three are plain
                      divs, so the digit is the only thing carrying their
                      order. */}
                  <div className="font-serif text-4xl font-normal italic text-brand-gradient">
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
            <Reveal className="overflow-hidden rounded-3xl border border-ink-line bg-ink px-6 py-16 text-center text-on-ink shadow-2xl sm:py-20">
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
              <p className="mx-auto mt-8 max-w-md border-t border-ink-line pt-8 text-on-ink-dim">
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
              <p className="mt-5 text-sm text-on-ink-dim">
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
