import { GuidePage } from "@/components/marketing/seo/templates";
import { RouteShell, renderablePage } from "@/components/marketing/seo/route-shell";
import { COD_GUIDE } from "@/content/pages/guide-whatsapp-cod-confirmation";
import { pageMeta } from "@/lib/seo/metadata";

export const metadata = pageMeta("shopify.guides.whatsapp.cod.confirmation");

export default function WhatsAppCodConfirmationGuidePage() {
  const page = renderablePage("shopify.guides.whatsapp.cod.confirmation");
  return (
    <RouteShell>
      <GuidePage page={page} content={COD_GUIDE} />
    </RouteShell>
  );
}
