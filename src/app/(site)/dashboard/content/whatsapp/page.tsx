import { WhatsAppEmbeddedSignup } from "@/components/integrations/whatsapp-embedded-signup";

type ConnectSource = "peakhour" | "shopify" | "wordpress";

interface Props {
  // Deep links from a connected store carry ?shop=<domain>&source=shopify so
  // the WABA binds to THAT store's business, not whichever workspace this
  // dashboard tab last had active. Next 16: searchParams is a Promise.
  searchParams: Promise<{ shop?: string; source?: string }>;
}

function normalizeSource(raw?: string): ConnectSource {
  return raw === "shopify" || raw === "wordpress" ? raw : "peakhour";
}

export default async function WhatsAppConnectPage({ searchParams }: Props) {
  const { shop, source } = await searchParams;
  const trimmedShop = shop?.trim();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">WhatsApp</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your WhatsApp Business account to message customers directly
          from Peakhour — order updates, reminders, and support, all in one place.
        </p>
      </div>

      <WhatsAppEmbeddedSignup
        shop={trimmedShop || undefined}
        source={normalizeSource(source)}
      />

      <div className="rounded-lg border p-4">
        <h2 className="text-sm font-medium">Message templates</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Draft, policy-check, and submit WhatsApp templates for approval — with a live preview.
        </p>
        <a
          href="/dashboard/content/whatsapp/templates"
          className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
        >
          Open the Template Studio →
        </a>
      </div>
    </div>
  );
}
