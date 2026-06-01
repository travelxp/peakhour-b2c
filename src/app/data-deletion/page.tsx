import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/utils";
import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";

export const metadata: Metadata = {
  title: "Data Deletion - Peakhour",
  description:
    "Request deletion of your data from Peakhour and check the status of a data-deletion request.",
};

type DeletionStatus = {
  status: "received" | "processing" | "completed" | "failed";
  requestedAt: string;
  completedAt?: string;
};

/**
 * Look up a data-deletion request by its confirmation code via the public
 * (unauthenticated) status endpoint. Returns null when no code is supplied,
 * the request isn't found, or the API is unreachable — the page degrades to
 * the static policy in every one of those cases.
 */
async function fetchStatus(code: string): Promise<DeletionStatus | null> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "";
  if (!base) return null;
  try {
    const res = await fetch(
      `${base}/v1/webhooks/meta/data-deletion/status?code=${encodeURIComponent(code)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { found?: boolean } & DeletionStatus;
    return json.found ? json : null;
  } catch {
    return null;
  }
}

function formatUtc(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : `${d.toUTCString()}`;
}

function StatusBlock({
  code,
  status,
}: {
  code: string;
  status: DeletionStatus | null;
}) {
  const requestedAt = formatUtc(status?.requestedAt);
  const completedAt = formatUtc(status?.completedAt);

  let tone = "border-border";
  let heading = "Request not found";
  let body =
    "We couldn’t find a data-deletion request for that reference code. The link may be incomplete — please check it, or contact us using the details below.";

  if (status) {
    if (status.status === "completed") {
      tone = "border-green-500/40 bg-green-500/5";
      heading = "Your data has been deleted";
      body =
        "We’ve removed the personal data associated with your Meta connection (profile details and access tokens we held). No further action is needed.";
    } else if (status.status === "failed") {
      tone = "border-red-500/40 bg-red-500/5";
      heading = "We hit a problem";
      body =
        "We couldn’t finish your deletion request automatically. Our team has been notified and will complete it. If you’d like an update, contact us with your reference code below.";
    } else {
      // received | processing
      tone = "border-amber-500/40 bg-amber-500/5";
      heading = "Your request is being processed";
      body =
        "We’ve received your data-deletion request and are processing it. You can revisit this page with your reference code to check progress.";
    }
  }

  return (
    <section className={`rounded-lg border p-5 ${tone}`}>
      <h2 className="text-lg font-semibold text-foreground">{heading}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <dl className="mt-4 space-y-1 text-xs text-muted-foreground">
        <div>
          <span className="font-medium text-foreground">Reference code:</span>{" "}
          <span className="font-mono">{code}</span>
        </div>
        {requestedAt && (
          <div>
            <span className="font-medium text-foreground">Requested:</span> {requestedAt}
          </div>
        )}
        {completedAt && (
          <div>
            <span className="font-medium text-foreground">Completed:</span> {completedAt}
          </div>
        )}
      </dl>
    </section>
  );
}

export default async function DataDeletionPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const status = code ? await fetchStatus(code) : null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold">Data Deletion</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {SITE.legalLastUpdated}
        </p>

        {code && (
          <div className="mt-8">
            <StatusBlock code={code} status={status} />
          </div>
        )}

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">
              Deleting your data from Peakhour
            </h2>
            <p className="mt-2">
              Peakhour (peakhour.ai) is an AI-powered marketing platform. When you connect a
              Meta account (Facebook, Instagram, or WhatsApp Business), we store the connection
              details needed to operate the integration on your behalf. You can ask us to delete
              that data at any time, and you control the connection from the platform that
              granted it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">How to request deletion</h2>
            <p className="mt-2">There are two ways to have your data deleted:</p>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              <li>
                <strong className="text-foreground">From Facebook:</strong> open{" "}
                <span className="font-medium">
                  Facebook → Settings &amp; privacy → Settings → Apps and Websites
                </span>
                , remove <strong className="text-foreground">Peakhour</strong>, and choose to
                request deletion of your data. Facebook notifies us automatically and we delete
                your connection data, then give you a reference code to track the request on this
                page.
              </li>
              <li>
                <strong className="text-foreground">By email:</strong> write to{" "}
                <a className="text-foreground underline" href={`mailto:${SITE.contactPrivacy}`}>
                  {SITE.contactPrivacy}
                </a>{" "}
                from the email on your Peakhour account and we’ll process the deletion for you.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">What we delete</h2>
            <p className="mt-2">
              We delete the personal data tied to your Meta connection — the profile information
              (name, profile details, email where provided) and the access tokens we hold to
              operate the integration. Once deleted, Peakhour can no longer act on your Meta
              account and the connection is removed.
            </p>
            <p className="mt-2">
              Content created within a Peakhour organization (for example, published posts and
              business records) is owned and controlled by that organization and is governed by
              our{" "}
              <Link className="text-foreground underline" href="/privacy-policy">
                Privacy Policy
              </Link>{" "}
              and the organization’s own retention settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">Checking your request</h2>
            <p className="mt-2">
              If you arrived here from a Facebook deletion request, your reference code is in the
              link (e.g. <span className="font-mono">/data-deletion?code=…</span>) and the status
              is shown at the top of this page. You can revisit the same link any time to check
              progress.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">Contact</h2>
            <p className="mt-2">
              Questions about a deletion request? Email{" "}
              <a className="text-foreground underline" href={`mailto:${SITE.contactPrivacy}`}>
                {SITE.contactPrivacy}
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
