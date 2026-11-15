import { notFound } from "next/navigation";
import { getPublicCatalog, signupCta } from "@/lib/catalog";
import { marketingTrialDays } from "@/lib/pricing";
import { getPage } from "@/lib/seo/pages";
import { isPreviewable, isPublishable } from "@/lib/seo/publish";
import type { PageRecord } from "@/lib/seo/types";
import type { HubContent } from "./content-types";
import { DaylightShell } from "./shell";
import { HubPage } from "./templates";

/**
 * The page's own primary CTA, unless the live catalog says another door is open: the record names the pre-launch
 * action (join the waitlist), and an open or invite-only platform names its own, the same resolver /pricing and the
 * homepage run, so the button can never disagree with the signup flow. With signups closed the record's action stays.
 */
export async function withCatalogCta(page: PageRecord): Promise<PageRecord> {
  const [catalog, trialDays] = await Promise.all([getPublicCatalog(), marketingTrialDays()]);
  const cta = signupCta(catalog?.platform?.signupMode ?? "open", trialDays);
  if (cta.disabled) return page;
  return { ...page, primaryCta: { label: cta.label, href: cta.href, kind: "waitlist" } };
}

/** One module hub route: 404 unless publishable (or a draft previewed off Production), then the Daylight hub. */
export async function HubRoute({ pageId, content }: { pageId: string; content: HubContent }) {
  const page = getPage(pageId);
  if (!isPublishable(page) && !isPreviewable(page)) notFound();
  return (
    <DaylightShell>
      <HubPage page={await withCatalogCta(page)} content={content} />
    </DaylightShell>
  );
}
