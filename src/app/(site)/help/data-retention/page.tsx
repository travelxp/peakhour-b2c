import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/utils";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";

export const metadata: Metadata = {
  title: "Data Retention - Peakhour",
  description:
    "How long Peakhour keeps the data it pulls from connected platforms, and why.",
};

/**
 * Public /help/data-retention page. Surfaces LinkedIn's Marketing API
 * data-storage rules in plain English so users can answer "why does
 * this panel only show the last 48 hours?" without filing support.
 * Updated whenever a new platform integration with its own retention
 * windows ships — see the TODO marker on Section 5.
 */
export default function DataRetentionPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold">Data Retention</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {SITE.legalLastUpdated}
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">
              1. Why some panels only show the last 48 hours
            </h2>
            <p className="mt-2">
              Connected platforms (LinkedIn, Meta, X, and others) place limits
              on how long partners are allowed to keep the data their APIs
              return. Peakhour respects those limits. When a panel in your
              dashboard says &ldquo;last 48 hours&rdquo; or &ldquo;last 2
              days&rdquo;, that&apos;s not a product choice &mdash; it&apos;s
              the platform&apos;s data-storage rule.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              2. LinkedIn retention windows
            </h2>
            <p className="mt-2">
              LinkedIn&apos;s Marketing API rules
              (
              <a
                href="https://learn.microsoft.com/en-us/linkedin/marketing/data-storage-requirements"
                target="_blank"
                rel="noreferrer noopener"
                className="underline underline-offset-2 hover:text-foreground"
              >
                published here
              </a>
              ) classify the data in three groups. Peakhour applies the
              corresponding storage limit to each:
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b text-foreground">
                    <th className="py-2 pr-4 font-medium">Data type</th>
                    <th className="py-2 pr-4 font-medium">
                      What it includes
                    </th>
                    <th className="py-2 font-medium">Peakhour retention</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="py-3 pr-4 align-top text-foreground">
                      Members&apos; social activity
                    </td>
                    <td className="py-3 pr-4 align-top">
                      Comments and reactions from individual LinkedIn members
                      on your posts; personal-feed posts from members.
                    </td>
                    <td className="py-3 align-top">
                      <span className="font-medium text-foreground">
                        48 hours
                      </span>{" "}
                      after collection.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 align-top text-foreground">
                      Organization social activity
                    </td>
                    <td className="py-3 pr-4 align-top">
                      Posts from a LinkedIn Company Page that you, the
                      authenticated administrator, manage through Peakhour.
                    </td>
                    <td className="py-3 align-top">
                      <span className="font-medium text-foreground">
                        6 months
                      </span>{" "}
                      after collection (authenticated-organization
                      allowance).
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 align-top text-foreground">
                      Aggregated marketing data
                    </td>
                    <td className="py-3 pr-4 align-top">
                      Statistics derived from the data above &mdash; counts,
                      scores, recency markers &mdash; alongside the stable
                      LinkedIn URN identifiers needed to join those scores
                      back to a person or page over time. We do not retain
                      raw comment text or third-party profile fields under
                      this allowance.
                    </td>
                    <td className="py-3 align-top">
                      <span className="font-medium text-foreground">
                        No fixed limit
                      </span>{" "}
                      (LinkedIn&apos;s aggregated-marketing-data
                      exception).
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4">
              A platform-wide cleanup runs every 6 hours and deletes anything
              past its window. Re-running the cleanup is safe; it never
              touches data inside the window.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              3. What this means for your dashboard
            </h2>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              <li>
                <span className="font-medium text-foreground">
                  Top engagers (LinkedIn):
                </span>{" "}
                ranked over the last 48 hours of comment activity. Once a
                comment ages past the window it is deleted and no longer
                contributes to the ranking.
              </li>
              <li>
                <span className="font-medium text-foreground">
                  Boost-worthy posts (LinkedIn):
                </span>{" "}
                posts become eligible 24 hours after publication and are
                scored for up to 14 days. Company Page posts run the full
                window. Personal-feed posts have an effective ceiling of
                48 hours under the Members&apos; Social Activity rule
                above &mdash; they are dropped by the cleanup before the
                14-day scoring window closes.
              </li>
              <li>
                <span className="font-medium text-foreground">
                  Long-term trends (planned):
                </span>{" "}
                under the aggregated-marketing-data allowance, Peakhour
                will retain anonymous counts, scores, and recency markers
                so the trend in engagement survives even after the raw
                comment trail is deleted. The writer that populates this
                aggregate ships in a follow-up release.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              4. Disconnecting a LinkedIn account
            </h2>
            <p className="mt-2">
              When you disconnect a LinkedIn account from Peakhour, we
              stop calling the LinkedIn API on its behalf. The
              social-activity rows we already collected drop out at the
              next scheduled cleanup under the same retention rules
              described above. Aggregated, derivative scores that
              don&apos;t reveal member-level information may remain in
              your business&apos;s analytics history.
            </p>
          </section>

          {/*
            TODO(retention-disclosure): When the next platform integration
            (Meta, X, TikTok) ships a dashboard backed by its own
            retention rules, add a per-platform section here with the same
            three-row structure as §2. The Header/Footer chrome and the
            §1 framing are intentionally platform-agnostic so only this
            section needs to grow. Don't let this page silently rot —
            check it on every platform-integration PR.
          */}
          <section>
            <h2 className="text-lg font-semibold text-foreground">
              5. Other platforms
            </h2>
            <p className="mt-2">
              Today this page covers LinkedIn, the only platform whose
              dashboard Peakhour ships to users. Meta, X, and other
              platforms each publish their own data-retention rules. As
              Peakhour adds dashboards for each platform, this page will
              gain a section per platform with the same structure as the
              LinkedIn table above.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">
              6. Questions
            </h2>
            <p className="mt-2">
              Anything unclear? Reach out through{" "}
              <Link
                href="/contact"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Contact
              </Link>
              . For the full picture of what Peakhour stores and why, see
              the{" "}
              <Link
                href="/privacy-policy"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
