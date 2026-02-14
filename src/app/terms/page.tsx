import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - PeakHour",
  description: "PeakHour terms of service — the agreement between you and PeakHour.",
};

const LAST_UPDATED = "February 14, 2026";
const CONTACT_EMAIL = "legal@peakhour.ai";

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {LAST_UPDATED}
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Agreement to Terms</h2>
            <p className="mt-2">
              These Terms of Service (&quot;Terms&quot;) constitute a legally binding
              agreement between you (&quot;you&quot; or &quot;User&quot;) and PeakHour
              (&quot;we&quot;, &quot;us&quot;, or &quot;Company&quot;) governing your access
              to and use of peakhour.ai and all associated services (the &quot;Service&quot;).
            </p>
            <p className="mt-2">
              By creating an account or using the Service, you agree to be bound by these
              Terms. If you do not agree, you may not use the Service. If you are using the
              Service on behalf of an organization, you represent that you have authority to
              bind that organization to these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Description of Service</h2>
            <p className="mt-2">
              PeakHour is an AI-powered marketing automation platform that:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Analyzes your content across multiple dimensions using artificial intelligence.</li>
              <li>Generates advertising creatives from your content for platforms including LinkedIn.</li>
              <li>Manages and optimizes advertising campaigns on connected platforms.</li>
              <li>Provides performance analytics and automated optimization recommendations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. Account Registration</h2>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>You must provide accurate, complete, and current information when registering.</li>
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You are responsible for all activities that occur under your account.</li>
              <li>You must notify us immediately of any unauthorized use of your account.</li>
              <li>You must be at least 18 years old to create an account.</li>
              <li>
                We reserve the right to suspend or terminate accounts that violate these Terms
                or remain inactive for an extended period.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Your Content</h2>

            <h3 className="mt-4 font-medium text-foreground">4.1 Ownership</h3>
            <p className="mt-2">
              You retain all ownership rights to content you upload, sync, or create through
              the Service (&quot;Your Content&quot;). This includes your original newsletters,
              articles, and other materials, as well as AI-generated outputs (ad creatives,
              tags, recommendations) derived from your content.
            </p>

            <h3 className="mt-4 font-medium text-foreground">4.2 License to Us</h3>
            <p className="mt-2">
              By uploading or syncing content, you grant us a limited, non-exclusive,
              worldwide license to use, process, store, and display Your Content solely for
              the purpose of providing and improving the Service. This license terminates when
              you delete your content or close your account.
            </p>

            <h3 className="mt-4 font-medium text-foreground">4.3 Your Responsibilities</h3>
            <p className="mt-2">You represent and warrant that:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>You own or have the right to use all content you submit to the Service.</li>
              <li>Your content does not infringe any third-party intellectual property rights.</li>
              <li>
                Your content does not contain unlawful, defamatory, or harmful material.
              </li>
              <li>
                Ad creatives generated through the Service and deployed to platforms comply
                with those platforms&apos; advertising policies. You are responsible for
                reviewing AI-generated content before deployment.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. AI-Generated Content</h2>
            <p className="mt-2">
              The Service uses artificial intelligence — including our proprietary AI/ML
              models and third-party AI providers — to generate ad creatives,
              recommendations, and other outputs. You acknowledge that:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                AI-generated content may not always be accurate, appropriate, or suitable for
                your purposes. You are responsible for reviewing all outputs before use.
              </li>
              <li>
                AI outputs are generated based on your content and may reflect biases or
                errors present in the source material.
              </li>
              <li>
                We do not guarantee that AI-generated ad creatives will comply with any
                specific advertising platform&apos;s policies. You are responsible for
                ensuring compliance.
              </li>
              <li>
                We do not guarantee any specific advertising performance, conversion rate,
                or return on investment from AI-generated creatives.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Third-Party Platform Integrations</h2>
            <p className="mt-2">
              The Service integrates with third-party platforms (e.g., LinkedIn, Beehiiv).
              When you connect these platforms:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                You authorize us to access and manage your accounts on those platforms within
                the scope of permissions you grant.
              </li>
              <li>
                You remain bound by each platform&apos;s own terms of service and policies.
              </li>
              <li>
                We are not responsible for changes to third-party APIs, policies, or terms
                that may affect the Service.
              </li>
              <li>
                You may disconnect third-party integrations at any time through your account
                settings. Disconnecting will stop data sync but will not delete previously
                synced data unless you request deletion.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Advertising and Budget Management</h2>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                You set advertising budgets and guardrails through the Service. You are
                responsible for the budgets you configure.
              </li>
              <li>
                While the Service includes automated safety guardrails (auto-pause on spend
                limits, maximum cost-per-acquisition caps), these are assistive tools and we
                do not guarantee they will prevent all overspend scenarios.
              </li>
              <li>
                Advertising spend is charged directly by the advertising platforms (e.g.,
                LinkedIn), not by PeakHour. You are responsible for all charges incurred on
                your advertising platform accounts.
              </li>
              <li>
                We are not liable for financial losses resulting from advertising campaigns
                managed through the Service.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Fees and Payment</h2>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                Service fees are as described on our pricing page. We reserve the right to
                change pricing with 30 days&apos; notice.
              </li>
              <li>
                Payments are processed through Stripe. By providing payment information, you
                agree to Stripe&apos;s terms of service.
              </li>
              <li>
                All fees are non-refundable except as required by applicable law or as
                explicitly stated in these Terms.
              </li>
              <li>
                We may offer free tiers, trials, or promotional pricing at our discretion.
                These may be modified or discontinued at any time.
              </li>
            </ul>

            <h3 className="mt-4 font-medium text-foreground">8.1 Plan Tiers</h3>
            <p className="mt-2">
              We offer three plan tiers that differ in pricing, data contribution, and AI
              model access:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                <strong>Community</strong> plans are offered at reduced pricing. By
                selecting a Community plan, you agree to contribute anonymized,
                de-identified usage data to improve the shared platform model, as
                described in our Privacy Policy (Section 4). Data contribution is a
                condition of Community plan pricing and cannot be disabled while on a
                Community plan. You receive access to the shared platform model.
              </li>
              <li>
                <strong>Professional</strong> plans are offered at standard pricing and
                do not include any data contribution. Your anonymized usage patterns are
                excluded from all aggregate training data. You receive access to the
                shared platform model without contributing to it.
              </li>
              <li>
                <strong>Enterprise</strong> plans are offered at premium pricing and
                include a dedicated private AI model trained exclusively on your
                organization&apos;s data. Your data does not contribute to the shared
                platform model. The private model is isolated to your organization and
                learns your specific industry patterns, audience behaviors, and campaign
                performance over time.
              </li>
            </ul>
            <p className="mt-2">
              All plan tiers provide the same core platform features. The pricing
              differences reflect: (a) the value that aggregated data contribution
              provides (Community discount), and (b) the dedicated infrastructure and
              compute resources required for private models (Enterprise premium), in
              compliance with applicable privacy regulations.
            </p>
            <h3 className="mt-4 font-medium text-foreground">8.2 Free Trial</h3>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                We may offer a free trial with limited usage. Free trial accounts require
                data contribution as a condition of the trial — by activating a trial,
                you agree to contribute anonymized, de-identified usage data to the shared
                platform model, as described in our Privacy Policy (Section 4.2).
              </li>
              <li>
                Free trials are subject to usage limits (e.g., number of creatives,
                campaigns, or content items) as described on our pricing page. These
                limits may be changed at our discretion.
              </li>
              <li>
                At the end of your trial period, you may choose any paid plan tier
                (Community, Professional, or Enterprise). If you do not select a paid
                plan, your account will be suspended until a plan is chosen. Your data
                will be retained for 30 days after trial expiration.
              </li>
            </ul>

            <h3 className="mt-4 font-medium text-foreground">8.3 Plan Changes</h3>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                You may change your plan tier at any time. Changes take effect at the
                start of your next billing cycle. If you switch from Community or a free
                trial to Professional or Enterprise, data contribution ceases at the plan
                change date; previously contributed anonymized data remains part of the
                aggregate dataset as it cannot be individually identified or extracted.
              </li>
              <li>
                If you downgrade from Enterprise, your private model is decommissioned
                at the end of your current billing cycle. Data used to train your private
                model is deleted within 30 days of decommissioning.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Acceptable Use</h2>
            <p className="mt-2">You agree not to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Use the Service for any unlawful purpose or in violation of any applicable laws.</li>
              <li>Upload content that infringes intellectual property rights or contains malware.</li>
              <li>
                Attempt to gain unauthorized access to the Service, other accounts, or our
                systems.
              </li>
              <li>
                Use the Service to create misleading, deceptive, or fraudulent advertising.
              </li>
              <li>
                Reverse engineer, decompile, or attempt to extract the source code of the
                Service.
              </li>
              <li>
                Use the Service in a way that could damage, disable, or impair the Service
                or interfere with other users&apos; access.
              </li>
              <li>
                Resell, sublicense, or provide access to the Service to third parties without
                our written consent.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">10. Intellectual Property</h2>
            <p className="mt-2">
              The Service, including its design, features, code, AI models, and documentation,
              is owned by PeakHour and protected by intellectual property laws. Nothing in
              these Terms grants you any right to our trademarks, logos, or brand assets.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">11. Disclaimers</h2>
            <p className="mt-2">
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT
              WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
              WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
              NON-INFRINGEMENT.
            </p>
            <p className="mt-2">
              We do not warrant that the Service will be uninterrupted, error-free, or
              secure. We do not warrant the accuracy of AI-generated content or that it
              will meet your specific requirements.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">12. Limitation of Liability</h2>
            <p className="mt-2">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, PEAKHOUR SHALL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING
              BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES, ARISING
              OUT OF OR RELATED TO YOUR USE OF THE SERVICE.
            </p>
            <p className="mt-2">
              OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS ARISING FROM OR RELATED TO THE
              SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE
              CLAIM.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">13. Indemnification</h2>
            <p className="mt-2">
              You agree to indemnify and hold PeakHour harmless from any claims, damages,
              losses, or expenses (including reasonable attorneys&apos; fees) arising from:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Your use of the Service.</li>
              <li>Your violation of these Terms.</li>
              <li>Your content or advertising campaigns deployed through the Service.</li>
              <li>Your violation of any third-party rights or applicable laws.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">14. Termination</h2>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                You may terminate your account at any time through your account settings or
                by contacting us.
              </li>
              <li>
                We may suspend or terminate your account if you violate these Terms, with or
                without notice depending on the severity of the violation.
              </li>
              <li>
                Upon termination, your right to use the Service ceases immediately. We will
                delete your data in accordance with our Privacy Policy.
              </li>
              <li>
                Sections 4.1 (Ownership), 11 (Disclaimers), 12 (Limitation of Liability),
                and 13 (Indemnification) survive termination.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">15. Modifications to Terms</h2>
            <p className="mt-2">
              We may modify these Terms at any time. We will notify you of material changes
              via email or through the Service at least 30 days before they take effect. Your
              continued use of the Service after changes take effect constitutes acceptance
              of the modified Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">16. Governing Law and Disputes</h2>
            <p className="mt-2">
              These Terms shall be governed by and construed in accordance with the laws of
              the jurisdiction in which PeakHour is incorporated, without regard to conflict
              of law principles. Any disputes arising from these Terms or the Service shall
              be resolved through binding arbitration, except where prohibited by applicable
              law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">17. General Provisions</h2>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                <strong>Entire Agreement:</strong> these Terms, together with the Privacy
                Policy, constitute the entire agreement between you and PeakHour.
              </li>
              <li>
                <strong>Severability:</strong> if any provision is held invalid or
                unenforceable, the remaining provisions remain in full force.
              </li>
              <li>
                <strong>Waiver:</strong> failure to enforce any right or provision does not
                constitute a waiver.
              </li>
              <li>
                <strong>Assignment:</strong> you may not assign these Terms without our
                consent. We may assign our rights and obligations without restriction.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">18. Contact Us</h2>
            <p className="mt-2">
              For questions about these Terms, contact us at:
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
