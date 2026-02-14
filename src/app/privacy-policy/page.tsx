import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - PeakHour",
  description: "PeakHour privacy policy — how we collect, use, and protect your data.",
};

const LAST_UPDATED = "February 14, 2026";
const CONTACT_EMAIL = "privacy@peakhour.ai";

export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
          <Link href="/" className="text-lg font-bold">
            PeakHour
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {LAST_UPDATED}
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Introduction</h2>
            <p className="mt-2">
              PeakHour (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the PeakHour platform
              (peakhour.ai), an AI-powered marketing automation service. This Privacy Policy
              explains how we collect, use, disclose, and safeguard your information when you
              use our website and services (collectively, the &quot;Service&quot;).
            </p>
            <p className="mt-2">
              By accessing or using the Service, you agree to this Privacy Policy. If you do
              not agree, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Information We Collect</h2>

            <h3 className="mt-4 font-medium text-foreground">2.1 Information You Provide</h3>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                <strong>Account information:</strong> name, email address, and password when
                you register for an account.
              </li>
              <li>
                <strong>Organization information:</strong> business name, website URL, industry
                type, and business details provided during onboarding.
              </li>
              <li>
                <strong>Payment information:</strong> billing details processed through our
                third-party payment processor (Stripe). We do not store full credit card numbers.
              </li>
              <li>
                <strong>Content:</strong> newsletters, articles, and other content you upload
                or sync from connected platforms for AI analysis.
              </li>
            </ul>

            <h3 className="mt-4 font-medium text-foreground">2.2 Information from Third-Party Platforms</h3>
            <p className="mt-2">
              When you connect third-party accounts (e.g., LinkedIn, Beehiiv), we receive:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                <strong>LinkedIn:</strong> basic profile information, ad account details,
                company page information, campaign performance metrics, and lead generation
                form responses, as authorized through OAuth.
              </li>
              <li>
                <strong>Beehiiv:</strong> newsletter content, subscriber metrics, and
                publication details via API integration.
              </li>
            </ul>

            <h3 className="mt-4 font-medium text-foreground">2.3 Automatically Collected Information</h3>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                <strong>Usage data:</strong> pages visited, features used, and actions taken
                within the Service.
              </li>
              <li>
                <strong>Device information:</strong> browser type, operating system, and
                device identifiers.
              </li>
              <li>
                <strong>Cookies:</strong> we use essential cookies for authentication and
                session management. See Section 7 for details.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. How We Use Your Information</h2>
            <p className="mt-2">We use collected information to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Provide, maintain, and improve the Service.</li>
              <li>
                Process your content through AI models to generate tags, ad creatives, and
                marketing recommendations.
              </li>
              <li>Manage your advertising campaigns on connected platforms.</li>
              <li>Monitor campaign performance and apply automated optimization rules.</li>
              <li>Send transactional emails (account verification, password resets, billing receipts).</li>
              <li>Respond to your requests and provide customer support.</li>
              <li>Detect, prevent, and address fraud, abuse, or technical issues.</li>
              <li>Comply with legal obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. AI Processing</h2>
            <p className="mt-2">
              Our Service uses artificial intelligence (powered by third-party AI providers)
              to analyze your content, generate ad creatives, and optimize campaigns. When
              processing your content through AI:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Content is sent to AI providers solely for processing your request.</li>
              <li>
                We use AI providers that do not train their models on customer data submitted
                through their API.
              </li>
              <li>AI-generated outputs (tags, creatives, recommendations) are stored in your account.</li>
              <li>You retain ownership of your original content and AI-generated outputs.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. How We Share Your Information</h2>
            <p className="mt-2">We do not sell your personal information. We share information only as follows:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                <strong>Service providers:</strong> third-party vendors that help us operate
                the Service (hosting, payment processing, AI providers, email delivery).
                These providers are contractually bound to protect your data.
              </li>
              <li>
                <strong>Connected platforms:</strong> when you authorize us to manage
                campaigns, we share ad creatives and targeting data with platforms like
                LinkedIn as necessary to run your campaigns.
              </li>
              <li>
                <strong>Legal requirements:</strong> when required by law, regulation, legal
                process, or governmental request.
              </li>
              <li>
                <strong>Business transfers:</strong> in connection with a merger, acquisition,
                or sale of assets, your information may be transferred. We will notify you
                before your data is subject to a different privacy policy.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Data Security</h2>
            <p className="mt-2">
              We implement appropriate technical and organizational measures to protect your
              information, including:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Encryption of data in transit (TLS/HTTPS) and at rest.</li>
              <li>Secure token storage for third-party platform credentials.</li>
              <li>Role-based access controls and multi-tenant data isolation.</li>
              <li>Regular security reviews and monitoring.</li>
            </ul>
            <p className="mt-2">
              No method of transmission or storage is 100% secure. While we strive to
              protect your data, we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Cookies</h2>
            <p className="mt-2">We use the following types of cookies:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                <strong>Essential cookies:</strong> required for authentication and session
                management. These are httpOnly cookies that cannot be accessed by JavaScript.
              </li>
              <li>
                <strong>OAuth state cookies:</strong> short-lived cookies used during
                third-party platform authorization flows (e.g., LinkedIn OAuth).
              </li>
            </ul>
            <p className="mt-2">
              We do not use advertising or tracking cookies. You can configure your browser
              to block cookies, but this may prevent you from using the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Data Retention</h2>
            <p className="mt-2">
              We retain your information for as long as your account is active or as needed
              to provide the Service. Upon account deletion:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Personal information is deleted within 30 days.</li>
              <li>Content and AI-generated data are deleted within 30 days.</li>
              <li>Third-party platform tokens are revoked and deleted immediately.</li>
              <li>
                Aggregated, anonymized data may be retained for analytics and service
                improvement.
              </li>
              <li>
                Data required for legal compliance may be retained for the legally required period.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Your Rights</h2>
            <p className="mt-2">
              Depending on your location, you may have the following rights regarding your
              personal data:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                <strong>Access:</strong> request a copy of the personal data we hold about you.
              </li>
              <li>
                <strong>Correction:</strong> request correction of inaccurate or incomplete data.
              </li>
              <li>
                <strong>Deletion:</strong> request deletion of your personal data.
              </li>
              <li>
                <strong>Portability:</strong> request your data in a structured, machine-readable format.
              </li>
              <li>
                <strong>Objection:</strong> object to processing of your data for specific purposes.
              </li>
              <li>
                <strong>Withdrawal of consent:</strong> withdraw consent for data processing
                where consent is the legal basis.
              </li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-foreground underline">
                {CONTACT_EMAIL}
              </a>
              . We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">10. International Data Transfers</h2>
            <p className="mt-2">
              Your information may be transferred to and processed in countries other than
              your country of residence. We ensure appropriate safeguards are in place for
              such transfers, including standard contractual clauses where required.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">11. Children&apos;s Privacy</h2>
            <p className="mt-2">
              The Service is not intended for individuals under the age of 18. We do not
              knowingly collect personal information from children. If we learn that we have
              collected data from a child, we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">12. Changes to This Policy</h2>
            <p className="mt-2">
              We may update this Privacy Policy from time to time. We will notify you of
              material changes by posting the new policy on this page and updating the
              &quot;Last updated&quot; date. Your continued use of the Service after changes
              constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">13. Contact Us</h2>
            <p className="mt-2">
              If you have questions about this Privacy Policy or our data practices, contact us at:
            </p>
            <p className="mt-2">
              Email:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-foreground underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto max-w-5xl px-4 text-center text-sm text-muted-foreground">
          <div className="flex justify-center gap-4">
            <Link href="/privacy-policy" className="underline">
              Privacy Policy
            </Link>
            <Link href="/terms" className="underline">
              Terms of Service
            </Link>
          </div>
          <p className="mt-2">
            PeakHour &copy; {new Date().getFullYear()}. AI-powered marketing for
            growing businesses.
          </p>
        </div>
      </footer>
    </div>
  );
}
