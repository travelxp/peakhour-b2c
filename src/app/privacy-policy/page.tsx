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
              Our Service uses artificial intelligence — including our proprietary AI/ML
              models and third-party AI providers — to analyze your content, generate ad
              creatives, and optimize campaigns. When processing your content through AI:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                Content may be processed by our proprietary models and/or third-party AI
                providers solely for the purpose of delivering the Service to you.
              </li>
              <li>
                Where third-party AI providers are used, we select providers that do not
                train their models on customer data submitted through their API.
              </li>
              <li>AI-generated outputs (tags, creatives, recommendations) are stored in your account.</li>
              <li>You retain ownership of your original content and AI-generated outputs.</li>
            </ul>

            <h3 className="mt-6 font-medium text-foreground">
              4.1 How Anonymized Data Improves the Platform for Everyone
            </h3>
            <p className="mt-2">
              PeakHour gets smarter over time. As more campaigns run across the platform,
              our AI learns which ad angles perform best for different industries, which
              headlines drive higher engagement, and which optimization patterns deliver
              the best results. This means every user benefits from the collective
              intelligence of the platform — better ad scoring, smarter creative
              suggestions, and more accurate performance predictions from day one.
            </p>
            <p className="mt-2">
              To make this possible, we use aggregated, anonymized, and de-identified
              data to train and improve our proprietary models. Here is exactly what that
              means and what protections are in place:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                <strong>All PII is permanently removed.</strong> Before any data enters
                our training pipeline, all personally identifiable information — including
                names, email addresses, account identifiers, organization names, and any
                other data that could identify an individual or business — is
                irreversibly stripped.
              </li>
              <li>
                <strong>Data is aggregated across the platform.</strong> We work with
                patterns and trends across many accounts, not individual content. For
                example, we may learn that &quot;question-based headlines outperform
                statement headlines in B2B SaaS ads&quot; — but we never know which
                specific account that insight came from.
              </li>
              <li>
                <strong>No reverse-engineering is possible.</strong> The anonymization
                process is one-way. The resulting dataset cannot be used to recover
                original content, identify its source, or link it back to any user or
                organization.
              </li>
              <li>
                <strong>Your content is never shared.</strong> Raw customer content,
                PII, or organization-identifiable data is never used to train any model.
                Your individual content is never shown to other customers, used in
                outputs for other accounts, or made publicly available.
              </li>
            </ul>

            <h3 className="mt-6 font-medium text-foreground">
              4.2 Plan Tiers and Data Processing
            </h3>
            <p className="mt-2">
              How your data is processed depends on your chosen plan tier. We offer three
              tiers, each with different data handling and AI model access:
            </p>

            <p className="mt-4 font-medium text-foreground">Community</p>
            <p className="mt-1">
              Community plans are offered at the lowest price point. By choosing a
              Community plan, you agree that your anonymized, de-identified usage patterns
              will be included in aggregate training data for the shared platform model.
              This is what enables Community pricing — your participation directly
              improves the platform for everyone. Data contribution is a condition of
              Community pricing and cannot be disabled while on a Community plan. You
              receive access to the shared platform model, which benefits from the
              collective intelligence of all Community users.
            </p>

            <p className="mt-4 font-medium text-foreground">Professional</p>
            <p className="mt-1">
              Professional plans are offered at standard pricing and exclude data
              contribution entirely. Your anonymized usage patterns will not be included
              in any aggregate training data. You still receive access to the shared
              platform model (trained on Community tier data), but your own data remains
              completely private.
            </p>

            <p className="mt-4 font-medium text-foreground">Enterprise</p>
            <p className="mt-1">
              Enterprise plans provide the highest level of data privacy and AI
              customization. Your data does not contribute to the shared model. In
              addition, you receive a dedicated private AI model that is trained
              exclusively on your organization&apos;s own data. This private model learns
              your specific industry patterns, audience behaviors, brand voice, and
              campaign performance over time — delivering increasingly personalized and
              accurate results. Your private model data is fully isolated and never
              mixed with data from other organizations or the shared platform model.
            </p>

            <p className="mt-4">
              You can upgrade or change your plan at any time from your account settings.
              Plan changes take effect at your next billing cycle. If you switch from
              Community to Professional or Enterprise, data contribution ceases at the
              plan change date; previously contributed anonymized data remains part of the
              aggregate dataset as it cannot be individually identified or extracted. If
              you downgrade from Enterprise, your private model is decommissioned at the
              end of your billing cycle.
            </p>
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
