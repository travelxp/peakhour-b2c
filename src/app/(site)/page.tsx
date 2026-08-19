import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Check,
  AlertTriangle,
  CheckCircle2,
  Info,
  Zap,
} from "lucide-react";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { pageMetadata } from "@/lib/seo";
import { HERO_TRUST_POINTS } from "@/lib/pillar-console";
import { AUDIENCE_SEGMENTS } from "@/lib/audience-segments";
import { PILLARS } from "@/lib/pillars";
import { badgedComingSoonKeys } from "@/lib/pillar-channels";
import { BrandBackdrop } from "@/components/marketing/brand-backdrop";
import { TerrainCanvas } from "@/components/marketing/terrain-canvas";
import { HeroConsole } from "@/components/marketing/hero-console";
import { PillarOrbit } from "@/components/marketing/pillar-orbit";
import { PillarCards } from "@/components/marketing/pillar-cards";
import { StepTimeline } from "@/components/marketing/step-timeline";
import {
  getPublicCatalog,
  publicMarketingIntegrations,
  signupCta,
  type PlatformSignupMode,
} from "@/lib/catalog";
import {
  IntegrationBrandIcon,
  integrationBrandColor,
} from "@/components/marketing/integration-brand";
import { STATIC_FALLBACK_INTEGRATIONS } from "@/lib/integrations-fallback";

export const metadata = pageMetadata({
  title: "Peakhour.ai — The AI business platform for growing brands",
  description:
    "Five AI modules — Commerce, Content, Growth, Support, Presence — that sell, publish, advertise, answer, and get you found. A free plan on every module. No credit card.",
  path: "/",
});

/**
 * Free → Pro ladder — the current pricing architecture. Free is a complete,
 * usable product; Pro adds BOTH capacity (Peaks) and capability (automations,
 * advanced insights, multiple workspaces, priority support). That capability
 * half is a deliberate, advertised difference, so don't reintroduce the older
 * "no feature paywalls / same product on Free and Paid" claim here. What stays
 * identical across tiers is the QUALITY of any single output.
 */
const FREE_POINTS = [
  {
    title: "Start in minutes",
    detail:
      "No credit card required. Connect your business and start using Peakhour for free.",
  },
  {
    title: "Upgrade when you’ve outgrown Free",
    detail:
      "Pro unlocks higher Peaks, more automations, advanced insights, multiple workspaces, and priority support — built for businesses using Peakhour every day.",
  },
  {
    title: "One AI currency across every product",
    detail:
      "Peaks power AI across Commerce, Content, Growth, Support, and Presence, giving you one simple way to manage AI usage across your business.",
  },
] as const;

// Same validator as /auth — sanitises a tampered ?ref= so the redirect target
// only ever carries a well-formed inviter code.
const REFERRAL_CODE_PATTERN = /^[0-9A-Z]{4,32}$/;

/**
 * The closing ask, phrased for the door that is actually open. `signupCta`
 * already picks the button label from the platform's signup mode; this picks
 * the sentence above it from the same fact, so the page can never invite
 * someone onto a waitlist that no longer exists (or offer a free start while
 * signups are shut).
 */
function closingLede(mode: PlatformSignupMode): string {
  const tail =
    "bring Commerce, Content, Growth, Support and Presence into one intelligence layer.";
  switch (mode) {
    case "waitlist_only":
      return `Join the Peakhour waitlist and ${tail}`;
    case "invite_only":
      return `Request an invite and ${tail}`;
    case "closed":
      return `Peakhour opens soon — and will ${tail}`;
    case "open":
      return `Start free with Peakhour and ${tail}`;
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[]; n?: string | string[] }>;
}) {
  // Back-compat redirect for waitlist share links minted with the old
  // `/?ref=…` shape → forward to /auth so the inviter code is captured + the
  // inviter credited on signup. `n` (cache-bust nonce) forwarded when present.
  const params = await searchParams;
  const refRaw = Array.isArray(params.ref) ? params.ref[0] : params.ref;
  const nRaw = Array.isArray(params.n) ? params.n[0] : params.n;
  if (refRaw) {
    const refUpper = refRaw.toUpperCase();
    if (REFERRAL_CODE_PATTERN.test(refUpper)) {
      const qs = new URLSearchParams({ ref: refUpper });
      if (nRaw) qs.set("n", nRaw);
      redirect(`/auth?${qs.toString()}`);
    }
  }

  // Integration catalog from the platform resolver (CMS-driven, env-gated,
  // stage-capped). Falls back to the static list below if the API is
  // unreachable so the landing never hard-fails.
  const catalog = await getPublicCatalog();
  const platform = catalog?.platform;
  const signupMode = platform?.signupMode ?? "open";
  const cta = signupCta(signupMode);
  // Fall back on an EMPTY published set too, not just a null catalog — a
  // catalog that publishes nothing would otherwise render the section heading
  // over an empty grid.
  const published = catalog ? publicMarketingIntegrations(catalog.integrations) : [];
  // Resolved ONCE, for both surfaces that state availability on this page: the
  // grid below and the "Channels & platforms" chips inside the pillar cards.
  // The chips are a client component, so they receive the answer as plain
  // strings rather than the catalog that produced it.
  const comingSoonKeys = badgedComingSoonKeys({
    published,
    all: catalog?.integrations ?? [],
  });
  // NOT named `comingSoon`: ResolvedIntegration has a field by that name (an
  // object carrying the CMS copy, read as i.comingSoon.copy in the map below),
  // and two unrelated things under one name in one object literal is how a
  // later reader ends up conflating them.
  const badgedKeys = new Set(comingSoonKeys);
  const integrationCards = published.length
    ? published.map((i) => ({
        id: i.key,
        name: i.name,
        // `||` not `??` — the CMS accepts an empty tagline, and `??` would
        // treat "" as present and silently blank the card's only line of copy.
        description: i.tagline || i.description || i.comingSoon?.copy || "",
        colorClass: integrationBrandColor(i.display?.groupKey, i.key),
        icon: (
          <IntegrationBrandIcon
            groupKey={i.display?.groupKey}
            integrationKey={i.key}
            name={i.name}
          />
        ),
        // The rule this used to spell out inline now lives in
        // badgedComingSoonKeys(), because the pillar chips have to apply the
        // same one. Unchanged in substance — see the note there, and note in
        // particular that the cap is read PER ROW: it marks the connectors
        // that are live underneath a pre-launch platform, not the platform.
        comingSoon: badgedKeys.has(i.key),
      }))
    : STATIC_FALLBACK_INTEGRATIONS.map((item) => {
        const IntIcon = item.icon;
        return {
          id: item.key,
          name: item.name,
          description: item.description,
          colorClass: item.color,
          icon: <IntIcon className="h-5 w-5" />,
          comingSoon: false,
        };
      });

  return (
    <div className="flex min-h-screen flex-col">
      {platform?.banner?.enabled && platform.banner.copy ? (
        <div
          role="status"
          className={
            "flex items-center justify-center gap-2 border-b px-4 py-2 text-center text-sm " +
            (platform.banner.tone === "warn"
              ? "bg-warning/15 text-warning-on-tint"
              : platform.banner.tone === "success"
                ? "bg-success/15 text-success-on-tint"
                : "bg-state-info/15 text-state-info-on-tint")
          }
        >
          {/* Leading icon so the tone isn't conveyed by color alone (a11y). */}
          {platform.banner.tone === "warn" ? (
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
          ) : platform.banner.tone === "success" ? (
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          ) : (
            <Info className="size-4 shrink-0" aria-hidden />
          )}
          <span>{platform.banner.copy}</span>
        </div>
      ) : null}

      {/* Free-first announcement bar */}
      <div className="bg-brand-gradient px-4 py-2 text-center text-sm font-semibold text-brand-contrast">
        Every module has a Free plan — no credit card required.{" "}
        <span className="font-normal opacity-80">
          One plan turns on all five when you&rsquo;re ready.
        </span>
      </div>

      <Header />

      <main>
        {/* Hero — the H1 states the visitor's problem, the orbit answers it.
            Everything down to the three trust points is sized to clear a
            laptop fold together with the header and the announcement bar. */}
        {/* ★THE HERO IS AN INSTRUMENT SURFACE NOW, not an ivory band with a
            whisper behind it. globals.css has defined --ink / --on-ink since
            the design system was written and the marketing site almost never
            used them; the hard ivory/ink cut is the strongest device the brand
            owns and it was sitting switched off.

            Three layers, back to front: a seeded contour field (the brand mark
            IS a contour map — see lib/terrain.ts), drifting aurora blooms, and
            the content. */}
        <section className="relative isolate overflow-hidden bg-ink pt-10 pb-14 text-on-ink sm:pt-14 sm:pb-20">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-20">
            <TerrainCanvas
              seed={17}
              options={{
                alpha: 0.72,
                scale: 1.05,
                rings: 34,
                step: 0.028,
                amp: 0.34,
                peaks: [
                  { x: 0.78, y: 0.3, r: 0.08, seed: 17 },
                  { x: 0.16, y: 0.84, r: 0.05, seed: 57 },
                ],
              }}
            />
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-[20%] -z-10 opacity-85 blur-[64px]"
          >
            <span className="aurora-blob absolute left-[4%] top-[2%] block size-[46vw] rounded-full bg-[radial-gradient(circle,rgba(255,201,79,.72),transparent_66%)]" />
            <span className="aurora-blob absolute right-[2%] top-[24%] block size-[40vw] rounded-full bg-[radial-gradient(circle,rgba(217,122,6,.68),transparent_66%)]" />
            <span className="aurora-blob absolute bottom-[-8%] left-[38%] block size-[30vw] rounded-full bg-[radial-gradient(circle,rgba(240,168,33,.58),transparent_68%)]" />
          </div>
          {/* Both grid tracks need `min-w-0` or a grid item's automatic
              minimum is its min-content, which on a phone sizes a track wider
              than the viewport and puts the whole page into a horizontal
              scroll. The copy column carries it below; the orbit's is on
              PillarOrbit's own root, which IS the second grid item. */}
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:gap-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="min-w-0">
              {/* The eyebrow carries the positioning badge; the H1 under it
                  is the visitor's own problem stated back to them. */}
              {/* text-brand, not text-brand-label: the label token darkens
                  for an ivory ground and this eyebrow now sits on ink, where
                  the bright gold is the legible one (~9:1). */}
              <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand">
                <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
                Peakhour Suite · five modules, one plan
              </span>
              {/* `block` on the accent, not a line break: the question has to
                  land on its own line at EVERY width, and a <br> would only
                  hold at the one the type was measured in. */}
              {/* ★The old H1 asked "Still running one business across 10
                  different tools?" — a question a visitor can answer "no" to,
                  describing their mess rather than your outcome. This is the
                  one sentence peakhour.ai is uniquely entitled to say. */}
              <h1 className="mt-5 text-3xl font-extrabold leading-[1.05] tracking-tight text-pretty text-on-ink sm:text-4xl lg:text-5xl">
                Every hour is peak hour.{" "}
                <span className="block font-serif italic font-normal text-brand-gradient">
                  Now you&rsquo;re staffed for it.
                </span>
              </h1>
              {/* One block, two sentences: what Peakhour does for you, then
                  what it covers. Splitting them into two ranks made the second
                  read as a second headline. */}
              <p className="mt-5 max-w-xl text-lg text-on-ink-dim">
                <span className="font-medium text-on-ink">
                  Five AI modules that sell, publish, advertise, answer and get
                  you found
                </span>{" "}
                — working your catalogue, in your voice, on one login and one
                Peaks wallet. You approve what ships.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                {cta.disabled ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-ink-line bg-white/5 px-5 py-3 text-sm font-medium text-on-ink-dim">
                    <Zap className="size-4" aria-hidden />
                    {cta.label}
                  </span>
                ) : (
                  <Link
                    href={cta.href}
                    className="group inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-6 py-3.5 text-sm font-bold text-brand-contrast shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    {cta.label} — all five modules
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                )}
                {/* Secondary CTA points at the story page, not at /peaks. A
                    visitor who has just read "10 different tools?" is asking
                    how this works, not how the AI currency is metered. */}
                <Link
                  href="/how-it-works"
                  className="inline-flex items-center gap-2 rounded-xl border-2 border-ink-line px-6 py-3 text-sm font-bold text-on-ink transition-colors hover:border-brand hover:text-brand"
                >
                  See how Peakhour works
                </Link>
              </div>
              {/* The three trust points. Kept directly under the CTA so they
                  clear the fold with it — they are the answer to "what does
                  clicking this cost me". */}
              <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-on-ink-dim">
                {HERO_TRUST_POINTS.map((promise, i) => (
                  <span key={promise} className="flex items-center gap-x-2">
                    {i > 0 && (
                      <span aria-hidden className="opacity-40">
                        ·
                      </span>
                    )}
                    <span aria-hidden className="font-bold text-brand">
                      ✓
                    </span>
                    {promise}
                  </span>
                ))}
              </p>
            </div>

            {/* ★The proof, where the diagram used to be. A page that
                describes software asks to be believed; a page that shows it
                running does not. PillarOrbit is not deleted — it moves to the
                modules section below, which is where a diagram of the five
                actually belongs. */}
            <div className="min-w-0">
              <HeroConsole />
            </div>
          </div>
        </section>

        {/* The five pillars — one row of tall panels that open in place.

            Each panel keeps `id={slug}` as a stable deep-link target, but note
            that nothing in the app points at one any more: the header and
            footer link to the /commerce … /presence ROUTES. So a visitor
            arriving on /#commerce lands on a panel that is scrolled to but
            still collapsed. Wire the hash to `pinned` in PillarCards if that
            path ever matters. */}
        <section className="border-t bg-muted/30 py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-label">
                <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
                The five modules
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">
                Everything a modern business does online, run by AI you approve.
              </h2>
              <p className="mt-3 text-muted-foreground">
                Each module works alone. Together they share one brain — your
                catalog, your brand voice, your customers.{" "}
                <span className="font-medium text-foreground">
                  Open any module to see what it runs.
                </span>
              </p>
            </div>
            {/* The orbit lands here, where it was always the better fit: a
                diagram of how the five relate belongs above the five, not in a
                hero whose job is to show the product working. */}
            <div className="mt-10 flex justify-center">
              <PillarOrbit />
            </div>
            <div className="mt-10">
              <PillarCards comingSoonKeys={comingSoonKeys} />
            </div>
          </div>
        </section>

        {/* Who it's for — the visitor sorting themselves before they read on.
            Problem first, then fit: the problem line names no product at all,
            so it can only be recognised or skipped, never argued with. */}
        <section className="relative isolate overflow-hidden py-12 sm:py-16">
          <BrandBackdrop flip />
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-label">
                <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
                Who Peakhour is for
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">
                Built for the businesses doing five jobs{" "}
                <span className="font-serif italic font-normal text-brand-gradient">
                  with one team.
                </span>
              </h2>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {AUDIENCE_SEGMENTS.map((segment) => {
                const SegmentIcon = segment.icon;
                return (
                  <div
                    key={segment.id}
                    className="u-lift flex flex-col gap-3 rounded-2xl border bg-background p-6"
                  >
                    <div className="flex items-center gap-3">
                      {/* --brand-soft / --brand-ink are theme-stable, so at
                          full opacity this tile is the brightest object on a
                          dark page. Same dark step /auth and /pricing use. */}
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft dark:bg-brand/12">
                        <SegmentIcon
                          className="size-4.5 text-brand-ink dark:text-brand-soft"
                          strokeWidth={2}
                          aria-hidden
                        />
                      </span>
                      <h3 className="text-lg font-bold tracking-tight">{segment.name}</h3>
                    </div>
                    {/* The problem is set at foreground weight and the fit
                        muted below it — the visitor recognises themselves
                        first, and only then reads what we do about it. */}
                    <p className="font-medium text-pretty">{segment.problem}</p>
                    <p className="text-sm text-muted-foreground">{segment.fit}</p>
                    <ul className="mt-auto flex flex-wrap gap-1.5 pt-1">
                      {segment.pillars.map((slug) => (
                        <li
                          key={slug}
                          className="rounded-full border border-brand/25 px-2.5 py-0.5 text-xs font-medium text-brand-label"
                        >
                          {PILLARS[slug].name}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Free-first economics — always-dark panel */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-12 overflow-hidden rounded-3xl border border-ink-line bg-ink p-8 text-on-ink shadow-2xl lg:grid-cols-[1.1fr_0.9fr] lg:p-12">
              <div>
                <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand">
                  <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
                  Start free. Scale when you&rsquo;re ready.
                </span>
                <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">
                  Everything you need to get started.{" "}
                  <span className="text-brand-gradient">
                    More power when your business grows.
                  </span>
                </h2>
                <p className="mt-4 max-w-lg text-on-ink-dim">
                  Start with the core Peakhour experience at no cost. Connect your
                  business, explore every product, and see real value before
                  upgrading. Move to Pro when you need more AI capacity, advanced
                  workflows, deeper insights, and team collaboration.
                </p>
              </div>
              <div className="flex flex-col gap-3.5">
                {FREE_POINTS.map((point) => (
                  <div
                    key={point.title}
                    className="flex gap-3 rounded-xl border border-brand/25 bg-brand/6 px-4 py-3.5 transition-colors hover:border-brand/60"
                  >
                    <Check className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2.5} />
                    <div>
                      <p className="text-sm font-bold">{point.title}</p>
                      <p className="text-xs text-on-ink-dim">{point.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* How it works — three stops on one line that draws itself as you
            scroll, so the steps read as a sequence rather than three cards. */}
        <section id="how-it-works" className="scroll-mt-24 border-t bg-muted/30 py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-label">
                <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
                How Peakhour works
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-pretty lg:text-4xl">
                From Setup to Autopilot.{" "}
                <span className="font-serif font-normal italic text-brand-gradient">
                  In 3 simple steps.
                </span>
              </h2>
            </div>
            <div className="mt-12">
              <StepTimeline />
            </div>
          </div>
        </section>

        {/* Integrations — catalog-driven.
            ★THE PAGE NEEDED A SECOND INK BAND. With only the hero on ink the
            treatment read as a patched header rather than a design; the page
            now alternates ivory and instrument surfaces, and this is the
            section that earns the dark one — "where Peakhour plugs in" is
            exactly the instrument-panel idea the system was built around. */}
        <section className="relative isolate overflow-hidden bg-ink py-14 text-on-ink sm:py-20">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-60">
            <TerrainCanvas
              seed={205}
              options={{ alpha: 0.45, scale: 1.35, rings: 24, core: false }}
            />
          </div>
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand">
                <span className="h-0.5 w-7 bg-brand-gradient" aria-hidden />
                Works with your stack
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-pretty text-on-ink lg:text-4xl">
                Plugged into the tools you already use.
              </h2>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {integrationCards.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-2xl border border-ink-line bg-white/[0.04] p-4 backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-brand hover:bg-white/[0.07]"
                >
                  {/* No `text-white` here — the foreground ships with the brand
                      class (see integrationBrandColor); two same-specificity
                      text utilities would be resolved by stylesheet order. */}
                  <div
                    className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${item.colorClass}`}
                  >
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-bold">
                      <span className="truncate">{item.name}</span>
                      {item.comingSoon && (
                        <span className="shrink-0 rounded-full border border-ink-line px-1.5 py-0 text-[10px] font-medium text-on-ink-dim">
                          Coming soon
                        </span>
                      )}
                    </p>
                    {item.description && (
                      <p className="line-clamp-1 text-xs text-on-ink-dim">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA — always-dark panel */}
        <section className="pt-12 pb-16 sm:pt-16 sm:pb-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="overflow-hidden rounded-3xl border border-ink-line bg-ink px-6 py-16 text-center text-on-ink shadow-2xl sm:py-20">
              <h2 className="mx-auto max-w-3xl text-3xl font-extrabold tracking-tight text-pretty sm:text-4xl">
                Ready to stop being the{" "}
                <span className="font-serif italic font-normal text-brand-gradient">
                  glue
                </span>{" "}
                between every part of your business?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-on-ink-dim">
                {closingLede(signupMode)}
              </p>
              {/* Both halves are gated together: the promise under the button
                  answers "what does clicking this cost me", and with signups
                  closed there is no button and nothing to answer. */}
              {!cta.disabled && (
                <>
                  <Link
                    href={cta.href}
                    className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-7 py-3.5 text-sm font-bold text-brand-contrast shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
                  >
                    {cta.label}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <p className="mt-5 text-sm text-on-ink-dim">
                    Free plan available · No credit card
                  </p>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
