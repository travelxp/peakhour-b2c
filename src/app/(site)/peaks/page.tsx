import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Peaks } from "@/components/peaks/peaks";
import { PeaksGlyph } from "@/components/peaks/peaks-glyph";
import { Bullets, FactsCard, Frame } from "@/components/marketing/seo/frame";
import { Section } from "@/components/marketing/seo/section";
import { DaylightShell } from "@/components/marketing/seo/shell";
import { cardCls, linkCls } from "@/components/marketing/seo/styles";
import { peaksContent, peaksNeedPlanSentence } from "@/content/pages/peaks";
import { formatPackPrice, formatPackUnitPrice, getPeaks, type PeakPack } from "@/lib/peaks";
import { bestValueKey, perThousandLabel } from "@/lib/peaks-pack-unit-price";
import { PEAKS_REFUND_SENTENCE } from "@/lib/peaks-refund-terms";
import { marketingTrialDays } from "@/lib/pricing";
import { pageMeta } from "@/lib/seo/metadata";
import { getPage } from "@/lib/seo/pages";
import { isPreviewable, isPublishable } from "@/lib/seo/publish";
import { getPublicCatalog, signupCta } from "@/lib/catalog";
import { trialStart } from "@/lib/trial-copy";

export const metadata = pageMeta("peaks");

/**
 * /peaks: the Peaks currency and the one-time top-up packs, in the Daylight kit. Server-rendered with the visitor's
 * country from the Vercel edge geo header (`x-vercel-ip-country`), so the API returns packs in the right currency
 * without client-side flicker. Packs are data-driven from peakhour-api `/v1/platform/peaks` (cfg_addons); when ops has
 * published none, the plan-managed fallback renders instead of a broken grid.
 */
export default async function PeaksPage() {
  const record = getPage("peaks");
  if (!isPublishable(record) && !isPreviewable(record)) notFound();

  const h = await headers();
  const vercelCountry = h.get("x-vercel-ip-country");
  const country = vercelCountry && /^[A-Za-z]{2}$/.test(vercelCountry) ? vercelCountry.toUpperCase() : "DEFAULT";

  // The trial is named only when the catalog gives one (owner rule 2026-10-06, `lib/trial-copy`).
  const [peaks, trialDays, catalog] = await Promise.all([getPeaks(country), marketingTrialDays(), getPublicCatalog()]);
  const signupMode = catalog?.platform?.signupMode ?? "open";
  const door = signupCta(signupMode, trialDays);
  const when = trialStart(signupMode, trialDays);
  const packs = peaks?.packs ?? [];
  const bestKey = bestValueKey(packs);

  const page = { ...record, primaryCta: { label: "View plans", href: "/pricing", kind: "trial" as const } };
  const content = { ...peaksContent(when !== "none"), secondaryCta: door.disabled ? undefined : { label: door.label, href: door.href } };

  return (
    <DaylightShell>
      <Frame
        page={page}
        content={content}
        art={
          <FactsCard
            title="Peaks at a glance"
            facts={[
              { label: "Monthly allowance", value: "In every plan" },
              { label: "Top-up packs", value: "Never expire" },
              { label: "Writing and editing yourself", value: "Free" },
              { label: "An example AI action", value: <Peaks amount={5} glyphSize={16} /> },
            ]}
          />
        }
      >
        <Section id="how" eyebrow="How Peaks work" title="Peaks come with your plan. Top up any time.">
          <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
            <HowCard
              title="Included with your plan"
              body={`Peaks power every Peakhour product, and every plan comes with a monthly allowance${when === "now" ? ", your free trial included" : when === "on_approval" ? ", and your free trial once you are approved" : ""}. Agency and Enterprise carry more.`}
            />
            <HowCard
              title="Spent only when AI works"
              body="Peaks are consumed when the AI actually runs: drafting, generating, analysing. Writing and editing yourself costs nothing."
            />
            <HowCard
              title="Top up when you need more"
              body={`Need more? Buy a Peaks pack any time. Purchased Peaks never expire and work across every Peakhour product. ${PEAKS_REFUND_SENTENCE}`}
            />
          </div>
        </Section>

        <Section
          id="packs"
          eyebrow="Top-up packs"
          title="One-time packs add Peaks to your balance."
          tone="muted"
          intro="Purchased Peaks never expire and work across every Peakhour product. No new subscription, no monthly reset."
        >
          {packs.length > 0 ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                {packs.map((pack) => (
                  <PackCard key={pack.key} pack={pack} bestValue={pack.key === bestKey} />
                ))}
              </div>
              <p className="mt-5 text-sm text-muted-foreground">Pack prices are in {currencyList(packs)}.</p>
            </>
          ) : (
            <div className={`${cardCls} max-w-xl p-6`}>
              <PeaksGlyph size={40} />
              <p className="mt-4 text-[15px] text-muted-foreground">
                Peaks come bundled with every paid plan. Self-serve top-up packs are rolling out soon. In the
                meantime, your plan&rsquo;s allowance has you covered, and our team can add Peaks on request.
              </p>
              <Link href="/pricing" className={`${linkCls} mt-4 inline-block`}>
                View plans
              </Link>
            </div>
          )}
          <div className={`${cardCls} mt-6 p-5 sm:p-6`}>
            <h3 className="text-lg font-extrabold tracking-tight">Good to know</h3>
            <Bullets
              className="mt-3 md:grid-cols-3 md:gap-x-8"
              items={[
                peaksNeedPlanSentence(when !== "none"),
                "Purchased Peaks never expire and work across any Peakhour product.",
                PEAKS_REFUND_SENTENCE,
              ]}
            />
          </div>
        </Section>
      </Frame>
    </DaylightShell>
  );
}

function HowCard({ title, body }: { title: string; body: string }) {
  return (
    <div className={`${cardCls} p-5 sm:p-6`}>
      <h3 className="text-lg font-extrabold tracking-tight">{title}</h3>
      <p className="mt-2 text-[15px] text-muted-foreground">{body}</p>
    </div>
  );
}

/** `bestValue` is derived from the unit prices (`bestValueKey`), never from the api's stored `highlight`, so the badge
 *  cannot contradict the per-1,000 line printed on the same card. */
function PackCard({ pack, bestValue }: { pack: PeakPack; bestValue: boolean }) {
  const unit = perThousandLabel(pack, (n) => formatPackUnitPrice(pack, n));
  return (
    <div className={`${cardCls} relative flex flex-col p-6 ${bestValue ? "border-brand ring-2 ring-brand" : ""}`}>
      {bestValue && (
        <span className="absolute -top-3 left-5 rounded-full bg-brand-gradient px-3 py-0.5 text-xs font-bold text-brand-contrast">
          Best value
        </span>
      )}
      <div className="flex items-center gap-2.5">
        <PeaksGlyph size={32} />
        <h3 className="font-extrabold tracking-tight">{pack.name}</h3>
      </div>
      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-4xl font-bold tabular-nums tracking-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>
          {formatPackPrice(pack)}
        </span>
        <span className="text-sm text-muted-foreground">one-time</span>
      </div>
      {unit && <p className="mt-1 text-sm tabular-nums text-muted-foreground">{unit}</p>}
      <p className="mt-3 text-sm font-bold">
        <span className="tabular-nums" style={{ fontFamily: "var(--font-space-grotesk)" }}>
          +{pack.credits.toLocaleString()}
        </span>{" "}
        Peaks added
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        Added to your balance. Never expires, works across every Peakhour product.
      </p>
    </div>
  );
}

/**
 * The currency the packs are priced in, read from the packs themselves ("USD"). The old line said "Prices shown for IN,
 * detected from your IP" beside dollar prices: the api answers a country with the currency it has packs for, which can
 * be another one, so the page states the currency it was given and never the visitor's country.
 */
function currencyList(packs: PeakPack[]): string {
  return [...new Set(packs.map((p) => p.currency.toUpperCase()))].join(" and ");
}
