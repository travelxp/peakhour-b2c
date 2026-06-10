import type { Metadata } from "next";
import { SITE } from "@/lib/utils";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";

export const metadata: Metadata = {
  title: "Cookie Policy - Peakhour",
  description:
    "Peakhour cookie policy — the cookies and similar technologies we use, why we use them, and how to control them.",
};

export default function CookiePolicyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header minimal />

      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold">Cookie Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {SITE.legalLastUpdated}
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Introduction</h2>
            <p className="mt-2">
              This Cookie Policy explains how {SITE.company.legalName} (&quot;{SITE.name}&quot;,
              &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) uses cookies and similar technologies on the
              {SITE.name} platform at peakhour.ai (the &quot;Service&quot;). It should be read
              together with our{" "}
              <a href="/privacy-policy" className="text-foreground underline">
                Privacy Policy
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. What Are Cookies?</h2>
            <p className="mt-2">
              Cookies are small text files placed on your device when you visit a website.
              They are widely used to make websites work, to remember your session, and to
              provide information to the site&apos;s operator. &quot;Similar technologies&quot; include
              local storage and session storage, which a site can use to store information in
              your browser for comparable purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. Cookies We Use</h2>
            <p className="mt-2">
              {SITE.name} is built to be privacy-respecting and uses only the cookies and
              browser storage necessary to operate the Service. We do <strong>not</strong> use
              advertising cookies, and we do <strong>not</strong> use cookies to track you
              across other websites.
            </p>

            <h3 className="mt-4 font-medium text-foreground">3.1 Strictly Necessary</h3>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                <strong>Authentication &amp; session cookies:</strong> keep you signed in and
                maintain your secure session. These are <code>httpOnly</code> cookies that
                cannot be read by JavaScript.
              </li>
              <li>
                <strong>OAuth state cookies:</strong> short-lived cookies used during
                third-party authorization flows (e.g., Meta, Google, LinkedIn, X) to protect
                against cross-site request forgery.
              </li>
              <li>
                <strong>Security cookies:</strong> used to protect the Service and detect
                abuse.
              </li>
            </ul>

            <h3 className="mt-4 font-medium text-foreground">3.2 Functional / Preferences</h3>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                Browser storage that remembers your in-app preferences (such as theme or UI
                settings) so the Service behaves the way you expect.
              </li>
            </ul>

            <p className="mt-3">
              Because these cookies are strictly necessary for the Service to function, they
              are set without requiring consent; blocking them may prevent you from signing in
              or using core features.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Analytics</h2>
            <p className="mt-2">
              Where we measure aggregate usage to improve the Service, we use
              privacy-friendly, aggregated analytics that do not rely on advertising cookies
              and are not used to identify you individually or track you across other sites.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Managing Cookies</h2>
            <p className="mt-2">
              You can control and delete cookies through your browser settings, and most
              browsers let you block cookies entirely. Because the cookies we use are
              strictly necessary, blocking or deleting them may stop you from signing in or
              using parts of the Service. Guidance for the major browsers is available in
              their respective help centers (Chrome, Safari, Edge, and Firefox).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Do Not Track</h2>
            <p className="mt-2">
              Because we do not track you across third-party websites or serve targeted
              advertising, we do not alter our practices in response to browser
              &quot;Do Not Track&quot; signals; there is no cross-site tracking to disable.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Changes to This Policy</h2>
            <p className="mt-2">
              We may update this Cookie Policy from time to time. We will post the updated
              version on this page and revise the &quot;Last updated&quot; date above.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Contact Us</h2>
            <p className="mt-2">
              Questions about this Cookie Policy can be sent to:
            </p>
            <p className="mt-2">
              {SITE.company.legalName}
              <br />
              {SITE.company.address}
              <br />
              Email:{" "}
              <a href={`mailto:${SITE.contactPrivacy}`} className="text-foreground underline">
                {SITE.contactPrivacy}
              </a>
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
