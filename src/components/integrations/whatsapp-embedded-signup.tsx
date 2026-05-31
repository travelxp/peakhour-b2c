"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useFacebookSdk, type FacebookLoginResponse } from "@/hooks/use-facebook-sdk";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WhatsAppIcon } from "@/components/ui/brand-icons";
import { CheckCircle2, AlertCircle, Loader2, Sparkles } from "lucide-react";

const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
const CONFIG_ID = process.env.NEXT_PUBLIC_META_ES_CONFIG_ID;

/** Result returned by POST /v1/meta/whatsapp/embedded-signup. */
interface ConnectResult {
  status: "connected";
  wabaId: string;
  phoneNumberId: string;
  appSubscribed: boolean;
  phoneRegistered: boolean;
  account: {
    name: string;
    phoneNumbers: Array<{ id: string; displayPhoneNumber: string; verifiedName: string }>;
  };
}

type Phase = "idle" | "launching" | "connecting" | "connected" | "error";

/** Meta's session-info postMessage payload (the slice we use). */
interface SessionInfoMessage {
  type?: string;
  event?: string;
  data?: { waba_id?: string; phone_number_id?: string };
}

const FB_ORIGINS = new Set([
  "https://www.facebook.com",
  "https://web.facebook.com",
  "https://business.facebook.com",
]);

export function WhatsAppEmbeddedSignup({
  onConnected,
}: {
  onConnected?: (result: ConnectResult) => void;
}) {
  const sdkState = useFacebookSdk(APP_ID);
  const configured = Boolean(APP_ID && CONFIG_ID);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConnectResult | null>(null);

  // The code (from FB.login) and the WABA/phone ids (from the session-info
  // postMessage) can arrive in either order — collect both in refs and POST
  // only once both are present. `completing` guards against a double-submit
  // when the second piece lands.
  const codeRef = useRef<string | null>(null);
  const sessionRef = useRef<{ wabaId: string; phoneNumberId: string } | null>(null);
  const completingRef = useRef(false);

  const reset = () => {
    codeRef.current = null;
    sessionRef.current = null;
    completingRef.current = false;
  };

  const complete = useCallback(async () => {
    if (completingRef.current) return;
    if (!codeRef.current || !sessionRef.current) return;
    completingRef.current = true;
    setPhase("connecting");
    setError(null);
    try {
      const res = await api.post<ConnectResult>(
        "/v1/meta/whatsapp/embedded-signup",
        {
          code: codeRef.current,
          wabaId: sessionRef.current.wabaId,
          phoneNumberId: sessionRef.current.phoneNumberId,
        },
      );
      setResult(res);
      setPhase("connected");
      onConnected?.(res);
    } catch (err) {
      setPhase("error");
      setError(
        err instanceof ApiError
          ? err.message
          : "We couldn’t finish connecting your WhatsApp account. Please try again.",
      );
    } finally {
      reset();
    }
  }, [onConnected]);

  // Capture the WABA + phone ids from Meta's Embedded Signup session-info event.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!FB_ORIGINS.has(event.origin)) return;
      let payload: SessionInfoMessage;
      try {
        payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (payload?.type !== "WA_EMBEDDED_SIGNUP") return;
      // FINISH (and the legacy FINISH_ONLY_WABA) carry the ids. A CANCEL means
      // the user closed the flow before finishing.
      if (payload.event === "CANCEL") {
        if (phase === "launching") {
          setPhase("idle");
          reset();
        }
        return;
      }
      const wabaId = payload.data?.waba_id;
      const phoneNumberId = payload.data?.phone_number_id;
      if (wabaId && phoneNumberId) {
        sessionRef.current = { wabaId, phoneNumberId };
        void complete();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [complete, phase]);

  const launch = useCallback(() => {
    if (sdkState !== "ready" || !window.FB || !CONFIG_ID) return;
    reset();
    setError(null);
    setResult(null);
    setPhase("launching");

    window.FB.login(
      (response: FacebookLoginResponse) => {
        const code = response?.authResponse?.code;
        if (!code) {
          // User closed/declined the popup, or no code came back.
          if (!sessionRef.current) {
            setPhase("idle");
            reset();
          }
          return;
        }
        codeRef.current = code;
        void complete();
      },
      {
        config_id: CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: { sessionInfoVersion: "3" },
      },
    );
  }, [sdkState, complete]);

  // ── Connected state ──────────────────────────────────────────
  if (phase === "connected" && result) {
    const phone = result.account.phoneNumbers[0];
    return (
      <Card className="border-green-500/40 bg-green-500/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-green-500/15">
              <CheckCircle2 className="size-5 text-green-600" />
            </span>
            <div>
              <CardTitle className="text-base">WhatsApp connected</CardTitle>
              <CardDescription>
                {result.account.name}
                {phone ? ` · ${phone.displayPhoneNumber}` : ""}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          You’re live. You can reply to customers right away; sending campaigns
          needs an approved message template.
          {!result.phoneRegistered && (
            <p className="mt-2 text-amber-600">
              We’re finishing your number setup in the background — if sending
              isn’t available yet, give it a minute.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Connect card ─────────────────────────────────────────────
  const busy = phase === "launching" || phase === "connecting";
  const disabled = !configured || sdkState !== "ready" || busy;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-[#25D366]/15">
            <WhatsAppIcon className="size-5 text-[#25D366]" />
          </span>
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              Connect WhatsApp
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                <Sparkles className="size-3" /> Live in a minute
              </span>
            </CardTitle>
            <CardDescription>
              Connect your WhatsApp Business number to message customers from
              PeakHour. No account yet? You can create one in the same step.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={launch} disabled={disabled} size="lg" className="gap-2">
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {phase === "connecting" ? "Finishing setup…" : "Opening WhatsApp…"}
            </>
          ) : (
            <>
              <WhatsAppIcon className="size-4" />
              Connect WhatsApp
            </>
          )}
        </Button>

        {!configured && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            WhatsApp connection isn’t configured yet. Set{" "}
            <code className="rounded bg-muted px-1">NEXT_PUBLIC_META_APP_ID</code>{" "}
            and{" "}
            <code className="rounded bg-muted px-1">NEXT_PUBLIC_META_ES_CONFIG_ID</code>.
          </p>
        )}

        {configured && sdkState === "loading" && (
          <p className="text-sm text-muted-foreground">Loading WhatsApp…</p>
        )}
        {configured && sdkState === "error" && (
          <p className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="size-4" />
            Couldn’t load the WhatsApp connector. Check your connection and
            refresh.
          </p>
        )}

        {phase === "error" && error && (
          <p className="flex items-start gap-2 text-sm text-red-600">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
