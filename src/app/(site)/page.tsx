import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, Info } from "lucide-react";
import { DaylightShell } from "@/components/marketing/seo/shell";
import { Frame, FactsCard } from "@/components/marketing/seo/frame";
import { Section } from "@/components/marketing/seo/section";
import { StatusChip } from "@/components/marketing/seo/capability-status";
import { WorkflowSteps } from "@/components/marketing/seo/workflow-steps";
import { withCatalogCta } from "@/components/marketing/seo/hub-route";
import { cardCls } from "@/components/marketing/seo/styles";
import { IntegrationBrandIcon, integrationBrandTile } from "@/components/marketing/integration-brand";
import { HOME_MODULES, homeContent } from "@/content/pages/home";
import { AUDIENCE_SEGMENTS } from "@/lib/audience-segments";
import { HOW_IT_WORKS_STEPS } from "@/lib/how-it-works";
import { getPublicCatalog, publicMarketingIntegrations, type PlatformSignupMode } from "@/lib/catalog";
import { STATIC_FALLBACK_INTEGRATIONS } from "@/lib/integrations-fallback";
import { badgedComingSoonKeys } from "@/lib/pillar-channels";
import { PILLARS } from "@/lib/pillars";
import { marketingTrialDays } from "@/lib/pricing";
import { getPage } from "@/lib/seo/pages";
import { pageMeta } from "@/lib/seo/metadata";
import { organizationLd, webSiteLd } from "@/lib/seo/structured-data";
import { JsonLd } from "@/components/marketing/seo/json-ld";
import { announcementBar, hasTrial, startPanel, trialNote } from "@/lib/trial-copy";

export const metadata = pageMeta("home");

/**
 * Trial → plan: the current pricing architecture (billing plan D19). There is no free tier and no per-module Pro: a
 * new account's first business starts on a Peakhour Suite trial when the catalog gives one (once per person, P3.1d),
 * and buys Suite, or Agency for many businesses, to keep going. Do not reintroduce "Free plan" or "Move to Pro".
 * Every trial sentence on this page is the catalog's (`marketingTrialDays` -> `lib/trial-copy`; owner rule 2026-10-06):
 * no trial, no promise.
 */

// Same validator as /auth: sanitises a tampered ?ref= so the redirect target only ever carries a well-formed code.
const REFERRAL_CODE_PATTERN = /^[0-9A-Z]{4,32}$/;

/** The closing ask, phrased for the door that is actually open (the sentence above the button, from the same fact). */
function closingLede(mode: PlatformSignupMode, trialDays: number | null): string {
  const tail = "bring Commerce, Content, Growth, Support and Presence onto one plan.";
  switch (mode) {
    case "waitlist_only":
      return `Join the Peakhour waitlist and ${tail}`;
    case "invite_only":
      return `Request an invite and ${tail}`;
    case "closed":
      return `Peakhour opens soon, and will ${tail}`;
    case "open":
      return hasTrial(trialDays) ? `Start a free trial of Peakhour and ${tail}` : `Start with Peakhour and ${tail}`;
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[]; n?: string | string[] }>;
}) {
  // Back-compat redirect for waitlist share links minted with the old `/?ref=...` shape: forward to /auth so the
  // inviter code is captured and the inviter credited on signup. `n` (cache-bust nonce) is forwarded when present.
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

  // Integration catalog from the platform resolver (CMS-driven, env-gated, stage-capped); the static list below is the
  // fallback so the landing never hard-fails, on an EMPTY published set too, not just a null catalog.
  const [catalog, trialDays] = await Promise.all([getPublicCatalog(), marketingTrialDays()]);
  const platform = catalog?.platform;
  const signupMode = platform?.signupMode ?? "open";
  const bar = announcementBar(trialDays);
  const panel = startPanel(trialDays);
  const closingNote = trialNote(trialDays);
  const published = catalog ? publicMarketingIntegrations(catalog.integrations) : [];
  const badged = new Set(badgedComingSoonKeys({ published, all: catalog?.integrations ?? [] }));
  const integrationCards = published.length
    ? published.map((i) => ({
        id: i.key,
        name: i.name,
        // `||` not `??`: the CMS accepts an empty tagline, and `??` would treat "" as present.
        description: i.tagline || i.description || i.comingSoon?.copy || "",
        tile: integrationBrandTile(i.display?.groupKey, i.key),
        icon: <IntegrationBrandIcon groupKey={i.display?.groupKey} integrationKey={i.key} name={i.name} />,
        // Read PER ROW (see badgedComingSoonKeys): it marks the connectors live under a pre-launch platform.
        comingSoon: badged.has(i.key),
      }))
    : STATIC_FALLBACK_INTEGRATIONS.map((item) => {
        const IntIcon = item.icon;
        return {
          id: item.key,
          name: item.name,
          description: item.description,
          tile: { className: "", style: item.tile },
          icon: <IntIcon className="h-5 w-5" />,
          comingSoon: false,
        };
      });

  const page = await withCatalogCta(getPage("home"));
  const content = homeContent(closingLede(signupMode, trialDays));

  const banner = (
    <>
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
          {/* Leading icon so the tone is not conveyed by color alone (a11y). */}
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
      {bar ? (
        <div className="bg-brand-gradient px-4 py-2 text-center text-sm font-semibold text-brand-contrast">
          {bar.lead} <span className="font-normal opacity-80">{bar.tail}</span>
        </div>
      ) : null}
    </>
  );

  return (
    <DaylightShell banner={banner}>
      {/* The company and the site, on the home page only (Bible 9.2): from SITE and the brand lockup, nothing the page does not show. */}
      <JsonLd data={organizationLd()} />
      <JsonLd data={webSiteLd()} />
      <Frame
        page={page}
        content={content}
        art={
          <FactsCard
            title="The five modules today"
            facts={HOME_MODULES.map((m) => ({ label: m.title, value: <StatusChip status={m.status} /> }))}
          />
        }
      >
        <Section id="modules" eyebrow="The five modules" title="Each module works alone. Open one to see what runs.">
          <ul role="list" className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {HOME_MODULES.map((m) => (
              <li key={m.title}>
                <Link
                  href={m.href}
                  className={`${cardCls} group flex h-full flex-col gap-2 p-5 transition-all hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-lg font-extrabold tracking-tight">{m.title}</span>
                    <StatusChip status={m.status} className="shrink-0" />
                  </span>
                  <span className="text-[15px] text-muted-foreground">{m.body}</span>
                  <span className="mt-auto flex items-center pt-1 text-sm font-bold">
                    See {m.title}
                    <ArrowRight aria-hidden className="ml-auto size-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
                  </span>
                </Link>
              </li>
            ))}
            <li className="flex flex-col justify-center gap-2 rounded-2xl bg-ink p-5 text-on-ink">
              <span className="text-lg font-extrabold tracking-tight">One plan, one wallet</span>
              <span className="text-[15px] text-on-ink-dim">
                All five modules sit on one Peakhour Suite plan and one Peaks wallet.
              </span>
              <Link href="/pricing" className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold underline underline-offset-4">
                See pricing <ArrowRight aria-hidden className="size-4" />
              </Link>
            </li>
          </ul>
        </Section>

        <Section id="for" eyebrow="Who it is for" title="Built for businesses doing five jobs with one team." tone="muted">
          <ul role="list" className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            {AUDIENCE_SEGMENTS.map((segment) => {
              const SegmentIcon = segment.icon;
              return (
                <li key={segment.id} className={`${cardCls} flex flex-col gap-3 p-5 sm:p-6`}>
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft">
                      <SegmentIcon className="size-[18px] text-brand-ink" strokeWidth={2} aria-hidden />
                    </span>
                    <h3 className="text-lg font-extrabold tracking-tight">{segment.name}</h3>
                  </div>
                  <p className="font-semibold text-pretty">{segment.problem}</p>
                  <p className="text-[15px] text-muted-foreground">{segment.fit}</p>
                  <ul className="mt-auto flex flex-wrap gap-1.5 pt-1">
                    {segment.pillars.map((slug) => (
                      <li key={slug} className="rounded-full border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                        {PILLARS[slug].name}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section id="how" eyebrow="How it works" title="Connect, approve, then let it run.">
          <WorkflowSteps steps={HOW_IT_WORKS_STEPS.map((s) => ({ title: s.title, body: s.description }))} />
        </Section>

        <section aria-labelledby="plan-h" className="pb-12 sm:pb-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-8 rounded-[28px] bg-ink p-6 text-on-ink sm:p-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:p-12">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-ink-dim">{panel.eyebrow}</p>
                <h2 id="plan-h" className="mt-3 text-[1.75rem] font-black leading-[1.06] tracking-[-0.03em] text-balance sm:text-4xl">
                  Everything on one plan. More power when you grow.
                </h2>
                <p className="mt-3 max-w-lg text-lg text-on-ink-dim">{panel.lede}</p>
              </div>
              <ul role="list" className="grid gap-3">
                {panel.points.map((point) => (
                  <li key={point.title} className="rounded-2xl border border-ink-line bg-white/5 px-4 py-3.5">
                    <p className="font-bold">{point.title}</p>
                    <p className="mt-0.5 text-sm text-on-ink-dim">{point.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <Section id="stack" eyebrow="Works with your stack" title="Plugged into the tools you already use." tone="muted">
          <ul role="list" className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {integrationCards.map((item) => (
              <li key={item.id} className={`${cardCls} flex items-center gap-3 p-4`}>
                {/* No `text-white` here: the foreground ships with the brand style (see integrationBrandTile). */}
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${item.tile.className}`} style={item.tile.style}>
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-bold">
                    <span className="truncate">{item.name}</span>
                    {item.comingSoon && (
                      <span className="shrink-0 rounded-full border px-1.5 text-micro font-medium text-muted-foreground">Coming soon</span>
                    )}
                  </p>
                  {item.description && <p className="line-clamp-1 text-xs text-muted-foreground">{item.description}</p>}
                </div>
              </li>
            ))}
          </ul>
          {closingNote && <p className="mt-6 text-sm text-muted-foreground">{closingNote}</p>}
        </Section>
      </Frame>
    </DaylightShell>
  );
}
