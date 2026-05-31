"use client";

import { WhatsAppEmbeddedSignup } from "@/components/integrations/whatsapp-embedded-signup";

export default function WhatsAppConnectPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">WhatsApp</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your WhatsApp Business account to message customers directly
          from PeakHour — order updates, reminders, and support, all in one place.
        </p>
      </div>

      <WhatsAppEmbeddedSignup />
    </div>
  );
}
