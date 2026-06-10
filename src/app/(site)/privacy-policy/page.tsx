import type { Metadata } from "next";
import { SITE } from "@/lib/utils";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";

export const metadata: Metadata = {
  title: "Privacy Policy - Peakhour",
  description: "Peakhour privacy policy — how we collect, use, and protect your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header minimal />

      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {SITE.legalLastUpdated}
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Introduction</h2>
            <p className="mt-2">
              This Privacy Policy explains how {SITE.company.legalName} (&quot;{SITE.name}&quot;,
              &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) — the company that operates the {SITE.name}{" "}
              platform at peakhour.ai, an AI-powered marketing automation service (the
              &quot;Service&quot;) — collects, uses, discloses, and safeguards your information when
              you use our website and services.
            </p>
            <p className="mt-2">
              {SITE.name} is a product of {SITE.company.legalName}, registered office at{" "}
              {SITE.company.address}. For the EU/UK General Data Protection Regulation
              (&quot;GDPR&quot;), {SITE.company.legalName} is the data &quot;controller&quot;; under
              India&apos;s Digital Personal Data Protection Act, 2023 (&quot;DPDP Act&quot;), it is the
              &quot;Data Fiduciary&quot; that determines the purpose and means of processing your
              personal data.
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
              When you connect a third-party account, you authorize that platform — through
              its OAuth consent screen — to share specific data with us. We request only the
              permissions (&quot;scopes&quot;) needed to provide the features you enable, and we
              process that data solely to deliver the Service to you (see Section 12,
              &quot;Third-Party Platform Data &amp; Developer-Program Compliance&quot;). Depending on
              the integrations you connect, we may receive:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                <strong>Meta (Facebook, Instagram, Ads &amp; WhatsApp Business):</strong> your
                public profile and email; the Facebook Pages and Instagram Business accounts
                you manage, their content and engagement/insights metrics; ad accounts,
                campaigns and performance data; and, where you connect WhatsApp Business,
                your WhatsApp Business Account(s), phone numbers, message templates and
                messaging metadata — each only as authorized through Meta&apos;s OAuth and
                subject to the Meta Platform Terms and Developer Policies.
              </li>
              <li>
                <strong>X (formerly Twitter):</strong> basic profile information and the
                posts, engagement metrics and advertising data you authorize, subject to the
                X Developer Agreement and Policy.
              </li>
              <li>
                <strong>LinkedIn:</strong> basic profile information, organization/company
                page information, ad account details, campaign performance metrics, and lead
                generation form responses, as authorized through OAuth and subject to the
                LinkedIn API Terms of Use.
              </li>
              <li>
                <strong>Google:</strong> where you connect Google services (e.g., analytics
                or business profiles), the account, profile and metrics data you authorize,
                handled in accordance with the Google API Services User Data Policy,
                including its Limited Use requirements.
              </li>
              <li>
                <strong>Beehiiv and other publishing tools:</strong> newsletter content,
                subscriber metrics, and publication details via API integration.
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
              Peakhour gets smarter over time. As more campaigns run across the platform,
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

            <p className="mt-4 font-medium text-foreground">Free Trial</p>
            <p className="mt-1">
              Free trial accounts include data contribution as a condition of the trial.
              By activating a free trial, you agree that your anonymized, de-identified
              usage patterns will be included in aggregate training data during the trial
              period. This allows us to offer the trial at no cost while improving the
              platform for all users. Trial accounts are subject to usage limits as
              described on our pricing page. At the end of your trial, you may choose any
              paid plan tier.
            </p>

            <p className="mt-4">
              You can upgrade or change your plan at any time from your account settings.
              Plan changes take effect at your next billing cycle. If you switch from
              Community or a free trial to Professional or Enterprise, data contribution
              ceases at the plan change date; previously contributed anonymized data
              remains part of the aggregate dataset as it cannot be individually
              identified or extracted. If you downgrade from Enterprise, your private
              model is decommissioned at the end of your billing cycle.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. How We Share Your Information</h2>
            <p className="mt-2">We do not sell your personal information. We share information only as follows:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                <strong>Service providers (sub-processors):</strong> vetted third-party
                vendors that help us operate the Service — including cloud hosting,
                database and object storage, AI/ML model providers, payment processing
                (Stripe), and transactional email delivery. These providers act on our
                instructions under written contracts (including data-processing terms and,
                where applicable, Standard Contractual Clauses) that require them to protect
                your data and use it only to provide their service to us. A current list of
                material sub-processors is available on request from{" "}
                <a href={`mailto:${SITE.contactPrivacy}`} className="text-foreground underline">
                  {SITE.contactPrivacy}
                </a>
                .
              </li>
              <li>
                <strong>Connected platforms:</strong> when you authorize us to publish
                content or manage campaigns, we share the content, ad creatives, targeting
                and configuration data necessary to carry out your instructions with the
                platforms you connect (e.g., Meta, X, LinkedIn, Google). We share with each
                platform only what is needed to perform the action you requested.
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
              to block cookies, but this may prevent you from using the Service. For full
              details of the cookies we set and their purposes, see our{" "}
              <a href="/cookie-policy" className="text-foreground underline">
                Cookie Policy
              </a>
              .
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
              <a href={`mailto:${SITE.contactPrivacy}`} className="text-foreground underline">
                {SITE.contactPrivacy}
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
            <h2 className="text-lg font-semibold text-foreground">
              12. Third-Party Platform Data &amp; Developer-Program Compliance
            </h2>
            <p className="mt-2">
              Where the Service accesses data through a third-party platform&apos;s API
              (&quot;Platform Data&quot;), we comply with that platform&apos;s developer terms and
              policies. As a general rule, we use Platform Data <strong>only</strong> to
              provide and improve the features you have enabled, we do <strong>not</strong>{" "}
              sell or rent Platform Data, we do <strong>not</strong> use it for our own
              advertising or to build independent user profiles, we retain it only for as
              long as needed to deliver the Service, and we delete it when you disconnect the
              integration, close your account, or ask us to.
            </p>

            <h3 className="mt-4 font-medium text-foreground">12.1 Meta Platform (Facebook, Instagram, Ads, WhatsApp)</h3>
            <p className="mt-2">
              Our use and transfer of information received from Meta APIs adheres to the{" "}
              <a href="https://developers.facebook.com/terms/" className="text-foreground underline" target="_blank" rel="noopener noreferrer">
                Meta Platform Terms
              </a>{" "}
              and Developer Policies. Meta Platform Data is used solely to provide the
              publishing, analytics, advertising and WhatsApp Business features you enable; it
              is never sold, and it is not used for any purpose other than delivering those
              features to you. You may revoke our access at any time from your Meta account
              settings, and you may request deletion of data we hold via our{" "}
              <a href="/data-deletion" className="text-foreground underline">
                Data Deletion
              </a>{" "}
              page.
            </p>

            <h3 className="mt-4 font-medium text-foreground">12.2 Google</h3>
            <p className="mt-2">
              Where you connect Google services, our use and transfer of information received
              from Google APIs adheres to the{" "}
              <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-foreground underline" target="_blank" rel="noopener noreferrer">
                Google API Services User Data Policy
              </a>
              , including its <strong>Limited Use</strong> requirements. We do not transfer or
              use Google user data for serving advertisements, we do not sell it, and we do not
              allow humans to read it except as expressly permitted (e.g., with your consent,
              for security, or to comply with law).
            </p>

            <h3 className="mt-4 font-medium text-foreground">12.3 X (formerly Twitter)</h3>
            <p className="mt-2">
              Our access to and use of X content and data complies with the X Developer
              Agreement and Policy. We use X data only to provide the features you enable and
              cease using, and delete, such data when you revoke access or as required by X.
            </p>

            <h3 className="mt-4 font-medium text-foreground">12.4 LinkedIn</h3>
            <p className="mt-2">
              Our use of LinkedIn data complies with the LinkedIn API Terms of Use and is
              limited to the authorized purposes for which you connected your LinkedIn account.
            </p>

            <h3 className="mt-4 font-medium text-foreground">12.5 Microsoft and other providers</h3>
            <p className="mt-2">
              Where you connect Microsoft or other third-party services, we comply with the
              applicable provider&apos;s API terms and use the data only to deliver the features
              you have enabled.
            </p>

            <h3 className="mt-4 font-medium text-foreground">12.6 Revoking access</h3>
            <p className="mt-2">
              You can disconnect any integration at any time from your account settings or
              from the relevant platform&apos;s app/connected-apps settings. On disconnection we
              revoke the stored access tokens and stop accessing that platform&apos;s data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">13. Legal Bases for Processing (EEA / UK)</h2>
            <p className="mt-2">
              If you are in the European Economic Area or the United Kingdom, we process your
              personal data on one or more of the following legal bases under the GDPR:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                <strong>Performance of a contract</strong> (Art. 6(1)(b)) — to create and
                operate your account and provide the Service you request.
              </li>
              <li>
                <strong>Legitimate interests</strong> (Art. 6(1)(f)) — to secure, maintain,
                analyze and improve the Service, prevent fraud and abuse, and communicate with
                you about the Service, balanced against your rights and freedoms.
              </li>
              <li>
                <strong>Consent</strong> (Art. 6(1)(a)) — where we rely on your consent (for
                example, certain optional integrations or communications); you may withdraw it
                at any time without affecting prior processing.
              </li>
              <li>
                <strong>Legal obligation</strong> (Art. 6(1)(c)) — to comply with applicable
                law, tax and accounting requirements, and lawful requests.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">14. Region-Specific Privacy Rights</h2>

            <h3 className="mt-4 font-medium text-foreground">14.1 European Economic Area &amp; United Kingdom (GDPR)</h3>
            <p className="mt-2">
              In addition to the rights in Section 9, you have the right to lodge a complaint
              with your local supervisory authority (in the UK, the Information
              Commissioner&apos;s Office). Where processing is based on consent or contract and is
              carried out by automated means, you also have the right to data portability.
            </p>

            <h3 className="mt-4 font-medium text-foreground">14.2 California (CCPA / CPRA)</h3>
            <p className="mt-2">
              If you are a California resident, you have the right to know what personal
              information we collect and how we use and disclose it, to request access and
              deletion, to correct inaccurate information, and to be free from discrimination
              for exercising these rights. You may use an authorized agent to submit requests.
            </p>
            <p className="mt-2">
              <strong>
                We do not &quot;sell&quot; or &quot;share&quot; your personal information as those terms are
                defined under the CCPA/CPRA,
              </strong>{" "}
              and we have not done so in the preceding twelve months.
            </p>

            <h3 className="mt-4 font-medium text-foreground">14.3 India (DPDP Act, 2023)</h3>
            <p className="mt-2">
              If you are in India, you have the right to access a summary of your personal data
              and our processing, to correction and erasure of your data, to nominate another
              person to exercise your rights in the event of death or incapacity, and to
              readily-available grievance redressal (see Section 15). Where we process your
              data on the basis of consent, you may withdraw that consent at any time with
              effect going forward. If you remain dissatisfied after contacting our Grievance
              Officer, you may approach the Data Protection Board of India.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">15. Grievance Redressal (India)</h2>
            <p className="mt-2">
              In accordance with the DPDP Act, 2023 and applicable Information Technology
              rules, {SITE.company.legalName} has appointed a Grievance Officer to address
              questions or complaints about this Privacy Policy and the processing of your
              personal data:
            </p>
            <p className="mt-2">
              {SITE.grievanceOfficer.name}, {SITE.company.legalName}
              <br />
              {SITE.company.address}
              <br />
              Email:{" "}
              <a href={`mailto:${SITE.grievanceOfficer.email}`} className="text-foreground underline">
                {SITE.grievanceOfficer.email}
              </a>
            </p>
            <p className="mt-2">
              We will acknowledge grievances promptly and aim to resolve them within the
              timeframes required by applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">16. Governing Law &amp; Jurisdiction</h2>
            <p className="mt-2">
              This Privacy Policy and any dispute arising out of or relating to it or the
              processing of your personal data are governed by the laws of India, and the
              courts at Mumbai, Maharashtra shall have exclusive jurisdiction, without
              prejudice to any mandatory data-protection or consumer rights available to you
              under the laws of your country of residence.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">17. Changes to This Policy</h2>
            <p className="mt-2">
              We may update this Privacy Policy from time to time. We will notify you of
              material changes by posting the new policy on this page and updating the
              &quot;Last updated&quot; date. Your continued use of the Service after changes
              constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">18. Contact Us</h2>
            <p className="mt-2">
              If you have questions about this Privacy Policy or our data practices, contact:
            </p>
            <p className="mt-2">
              {SITE.company.legalName}
              <br />
              {SITE.company.address}
              <br />
              Privacy:{" "}
              <a href={`mailto:${SITE.contactPrivacy}`} className="text-foreground underline">
                {SITE.contactPrivacy}
              </a>
              <br />
              Grievance Officer (India):{" "}
              <a href={`mailto:${SITE.grievanceOfficer.email}`} className="text-foreground underline">
                {SITE.grievanceOfficer.email}
              </a>
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
