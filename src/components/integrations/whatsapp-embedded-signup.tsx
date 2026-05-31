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
import { CheckCircle2, AlertCircle, Loader2, Sparkles, Info } from "lucide-react";

const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
const CONFIG_ID = process.env.NEXT_PUBLIC_META_ES_CONFIG_ID;

/** How long to wait for BOTH the auth code and the WABA/phone ids before
 *  giving up — guards against a missed Meta FINISH event leaving the UI
 *  spinning forever. */
const WATCHDOG_MS = 90_000;

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

/**
 * Deep-search a parsed postMessage payload for the WABA + phone-number ids.
 * Meta's Embedded Signup session-info event has varied in nesting across SDK
 * versions (`data.waba_id` vs `data.data.waba_id`); searching by key name is
 * robust to that and to future shape changes. Only string id values are read —
 * nothing from the payload is executed.
 */
function findSignupIds(obj: unknown): { wabaId?: string; phoneNumberId?: string } {
  const out: { wabaId?: string; phoneNumberId?: string } = {};
  const visit = (o: unknown, depth: number) => {
    if (!o || typeof o !== "object" || depth > 6) return;
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (k === "waba_id" && typeof v === "string") out.wabaId = v;
      else if (k === "phone_number_id" && typeof v === "string") out.phoneNumberId = v;
      else if (v && typeof v === "object") visit(v, depth + 1);
    }
  };
  visit(obj, 0);
  return out;
}

/** Accept messages only from Facebook origins. */
function isFacebookOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "facebook.com" || host.endsWith(".facebook.com");
  } catch {
    return false;
  }
}

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
  // only once both are present. `completingRef` guards against a double-submit.
  const codeRef = useRef<string | null>(null);
  const sessionRef = useRef<{ wabaId: string; phoneNumberId: string } | null>(null);
  const completingRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearWatchdog = () => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  };

  const resetPieces = () => {
    codeRef.current = null;
    sessionRef.current = null;
    completingRef.current = false;
  };

  const complete = useCallback(async () => {
    if (completingRef.current) return;
    if (!codeRef.current || !sessionRef.current) return;
    completingRef.current = true;
    clearWatchdog(); // both pieces in hand — the POST owns the outcome now
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
      resetPieces();
    }
  }, [onConnected]);

  // Capture the WABA + phone ids from Meta's Embedded Signup session-info event.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!isFacebookOrigin(event.origin)) return;
      let payload: { type?: string; event?: string } & Record<string, unknown>;
      try {
        payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (payload?.type !== "WA_EMBEDDED_SIGNUP") return;

      if (payload.event === "CANCEL") {
        // User closed the flow before finishing.
        clearWatchdog();
        if (phase === "launching") setPhase("idle");
        resetPieces();
        return;
      }

      const { wabaId, phoneNumberId } = findSignupIds(payload);
      if (wabaId && phoneNumberId) {
        sessionRef.current = { wabaId, phoneNumberId };
        void complete();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [complete, phase]);

  // Tear down the watchdog if the component unmounts mid-flow.
  useEffect(() => () => clearWatchdog(), []);

  const launch = useCallback(() => {
    if (sdkState !== "ready" || !window.FB || !CONFIG_ID) return;
    resetPieces();
    clearWatchdog();
    setError(null);
    setResult(null);
    setPhase("launching");

    // Watchdog: if we never collect both code + ids (e.g. Meta's FINISH event
    // is blocked or never arrives), don't spin forever.
    watchdogRef.current = setTimeout(() => {
      if (completingRef.current) return; // POST already started
      resetPieces();
      setPhase("error");
      setError(
        "We didn’t hear back from WhatsApp. Please try connecting again.",
      );
    }, WATCHDOG_MS);

    window.FB.login(
      (response: FacebookLoginResponse) => {
        const code = response?.authResponse?.code;
        if (!code) {
          // User closed/declined the popup, or no code came back. If the
          // session ids haven't arrived either, return to idle.
          if (!sessionRef.current) {
            clearWatchdog();
            setPhase("idle");
            resetPieces();
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
        <p className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          Have ready a phone number that can receive an SMS or call and is{" "}
          <strong className="font-medium text-foreground">not</strong> currently
          active on the WhatsApp or WhatsApp Business app — Meta verifies it in
          the popup.
        </p>

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
          <p
            role="alert"
            className="flex items-center gap-2 text-sm text-red-600"
          >
            <AlertCircle className="size-4" />
            Couldn’t load the WhatsApp connector. Check your connection and
            refresh.
          </p>
        )}

        {phase === "error" && error && (
          <p
            role="alert"
            className="flex items-start gap-2 text-sm text-red-600"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
