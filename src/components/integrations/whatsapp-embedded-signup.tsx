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
import { Skeleton } from "@/components/ui/skeleton";
import { WhatsAppIcon } from "@/components/ui/brand-icons";
import { CheckCircle2, AlertCircle, Loader2, Sparkles } from "lucide-react";

const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
const CONFIG_ID = process.env.NEXT_PUBLIC_META_ES_CONFIG_ID;

/** How long to wait for BOTH the auth code and the WABA/phone ids before
 *  giving up — guards against a missed Meta FINISH event leaving the UI
 *  spinning forever. */
const WATCHDOG_MS = 90_000;

/**
 * Which Embedded Signup variant to launch (C5, whatsapp-v4-features-plan.md):
 *  - "coexistence" — the merchant keeps using the WhatsApp Business app on
 *    their phone; ES runs with extras.featureType
 *    "whatsapp_business_app_onboarding" and pairs the existing number
 *    (in-flow QR/code step on their phone). The FINISH event may carry only
 *    waba_id — the api resolves the phone number server-side.
 *  - "standard" — new/dedicated number, classic flow.
 */
type ConnectFlow = "standard" | "coexistence";

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

/** Result of GET /v1/meta/whatsapp/connection (status-on-mount). */
interface StatusResult {
  connected: boolean;
  needsReauth?: boolean;
  name?: string;
  phoneNumber?: string;
  phoneRegistered?: boolean;
}

/** The connected-account info the UI renders, from either source. */
interface ConnectionInfo {
  name?: string;
  phoneNumber?: string;
  phoneRegistered: boolean;
}

type Phase =
  | "checking"
  | "idle"
  | "launching"
  | "connecting"
  | "connected"
  | "disconnecting";

/**
 * Deep-search a parsed postMessage payload for the WABA + phone-number ids.
 * Meta's Embedded Signup session-info event has varied in nesting across SDK
 * versions; searching by key name is robust to that. Only string id values are
 * read — nothing from the payload is executed.
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

  const [phase, setPhase] = useState<Phase>("checking");
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);
  // Coexistence is the default — most SMBs already live in the WhatsApp
  // Business app, and keeping it is the whole point of the variant.
  const [flow, setFlow] = useState<ConnectFlow>("coexistence");

  // The code (from FB.login) and the WABA/phone ids (from the session-info
  // postMessage) can arrive in either order — collect both in refs and POST
  // once enough is present. `completingRef` guards against a double-submit.
  // Coexistence FINISH may carry only waba_id (api resolves the phone), so
  // the ids are collected piecemeal rather than as an all-or-nothing pair.
  const codeRef = useRef<string | null>(null);
  const sessionRef = useRef<{ wabaId?: string; phoneNumberId?: string }>({});
  // The flow the CURRENT popup was launched with — completion semantics
  // must not change if the user flips the selector mid-flight.
  const flowRef = useRef<ConnectFlow>("coexistence");
  const completingRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set once the user starts a connect/disconnect — so a slow status-on-mount
  // fetch can't resolve late and clobber a user-initiated transition.
  const interactedRef = useRef(false);

  const clearWatchdog = () => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  };

  const resetPieces = () => {
    codeRef.current = null;
    sessionRef.current = {};
    completingRef.current = false;
  };

  // ── Status on mount: reflect an existing connection instead of always
  //    showing "Connect" (and surface needs-reauth as a repair prompt). ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await api.get<StatusResult>("/v1/meta/whatsapp/connection");
        if (cancelled || interactedRef.current) return;
        if (s.connected && !s.needsReauth) {
          setConnection({
            name: s.name,
            phoneNumber: s.phoneNumber,
            phoneRegistered: Boolean(s.phoneRegistered),
          });
          setPhase("connected");
        } else {
          setNeedsReauth(Boolean(s.connected && s.needsReauth));
          setPhase("idle");
        }
      } catch {
        if (!cancelled && !interactedRef.current) setPhase("idle"); // degrade to the connect card
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const complete = useCallback(async () => {
    if (completingRef.current) return;
    const { wabaId, phoneNumberId } = sessionRef.current;
    if (!codeRef.current || !wabaId) return;
    // Standard flow always delivers both ids; coexistence FINISH may carry
    // only waba_id — the api resolves the phone from the WABA's list.
    if (!phoneNumberId && flowRef.current !== "coexistence") return;
    completingRef.current = true;
    clearWatchdog(); // enough pieces in hand — the POST owns the outcome now
    setPhase("connecting");
    setError(null);
    try {
      const res = await api.post<ConnectResult>(
        "/v1/meta/whatsapp/embedded-signup",
        {
          code: codeRef.current,
          wabaId,
          ...(phoneNumberId ? { phoneNumberId } : {}),
          flow: flowRef.current,
          source: "peakhour",
        },
      );
      setConnection({
        name: res.account.name,
        phoneNumber: res.account.phoneNumbers[0]?.displayPhoneNumber,
        phoneRegistered: res.phoneRegistered,
      });
      setNeedsReauth(false);
      setPhase("connected");
      onConnected?.(res);
    } catch (err) {
      setPhase("idle");
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

      const data =
        payload.data && typeof payload.data === "object"
          ? (payload.data as Record<string, unknown>)
          : undefined;

      // Error surface — ES v4 reports user-visible flow errors as a CANCEL
      // event whose data carries { error_message, error_code, session_id,
      // timestamp }. v4-ONLY by decision (2026-06-11): no onboarded customers
      // exist, so the legacy v3 ERROR event isn't handled.
      // (developers.facebook.com/documentation/business-messaging/
      // whatsapp/embedded-signup/implementation/)
      const errorMessage =
        typeof data?.error_message === "string" ? data.error_message : undefined;
      if (payload.event === "CANCEL" && errorMessage) {
        clearWatchdog();
        resetPieces();
        setPhase("idle");
        // Friendly message only — never surface Meta's raw error blob. The
        // session_id is Meta's support reference for the failed ES session.
        const sessionId =
          typeof data?.session_id === "string" ? data.session_id : undefined;
        // F2 — persist the failed session for support escalations to Meta
        // (fire-and-forget; losing the log must never affect the UI).
        if (sessionId) {
          void api
            .post("/v1/meta/whatsapp/embedded-signup/failure", {
              sessionId,
              errorMessage,
              ...(typeof data?.current_step === "string"
                ? { currentStep: data.current_step }
                : {}),
            })
            .catch(() => {});
        }
        const ref = sessionId ? ` (ref ${sessionId})` : "";
        setError(
          `Something went wrong in the WhatsApp signup window. Please try again.${ref}`,
        );
        return;
      }

      // Plain abandonment — v4 CANCEL carries data.current_step (which screen
      // the user left from); no error to show, just unwind quietly.
      if (payload.event === "CANCEL") {
        clearWatchdog();
        if (phase === "launching") setPhase("idle");
        resetPieces();
        return;
      }

      // FINISH (v4 may emit FINISH variants as <FLOW_FINISH_TYPE> — exact
      // enum values are undocumented): v4 data carries phone_number_id,
      // waba_id, business_id (+ optional product arrays); the coexistence
      // finish is documented to carry waba_id ONLY. The deep search below
      // is event-name-agnostic on purpose — it keys on the ids, so any v4
      // FINISH variant resolves. Ids are merged piecemeal; complete() owns
      // the per-flow "do we have enough" decision.
      const { wabaId, phoneNumberId } = findSignupIds(payload);
      if (wabaId) sessionRef.current.wabaId = wabaId;
      if (phoneNumberId) sessionRef.current.phoneNumberId = phoneNumberId;
      if (sessionRef.current.wabaId) {
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
    interactedRef.current = true;
    resetPieces();
    clearWatchdog();
    setError(null);
    setPhase("launching");
    // Freeze the flow for this popup — flipping the selector mid-flight
    // must not change how the in-flight session completes.
    flowRef.current = flow;

    watchdogRef.current = setTimeout(() => {
      if (completingRef.current) return; // POST already started
      resetPieces();
      setPhase("idle");
      setError("We didn’t hear back from WhatsApp. Please try connecting again.");
    }, WATCHDOG_MS);

    window.FB.login(
      (response: FacebookLoginResponse) => {
        const code = response?.authResponse?.code;
        if (!code) {
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
        // ES v4: the flow version is selected by the Facebook Login for
        // Business *configuration* (config_id) — created under App Dashboard →
        // Facebook Login for Business → Configurations with the "Embedded
        // Signup" login variation; "Selecting the products will automatically
        // set you to v4". No extras.version param is sent for stable v4.
        // (developers.facebook.com/documentation/business-messaging/whatsapp/
        // embedded-signup/versions/ and .../version-4/)
        config_id: CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          // v4 reference invocation sends an (empty) setup object
          // (.../embedded-signup/implementation/). v4-ONLY by decision
          // (2026-06-11): no onboarded customers exist, so no v2/v3
          // sessionInfoVersion tolerance — NEXT_PUBLIC_META_ES_CONFIG_ID
          // must be a v4 configuration id.
          setup: {},
          // Coexistence (C5): launches the "connect your existing WhatsApp
          // Business app account" variant — the merchant keeps their app
          // and pairs the same number to Cloud API in-flow. The deprecated
          // "coexistence" value is invalid; this is the current one
          // (changelog 2025-05-29; R1 verified spec).
          ...(flow === "coexistence"
            ? { featureType: "whatsapp_business_app_onboarding" }
            : {}),
        },
      },
    );
  }, [sdkState, complete, flow]);

  const disconnect = useCallback(async () => {
    interactedRef.current = true;
    setPhase("disconnecting");
    setError(null);
    try {
      await api.delete("/v1/meta/whatsapp/connection");
      setConnection(null);
      setNeedsReauth(false);
      setPhase("idle");
    } catch (err) {
      setPhase("connected"); // stay connected on failure
      setError(
        err instanceof ApiError
          ? err.message
          : "We couldn’t disconnect WhatsApp. Please try again.",
      );
    }
  }, []);

  // ── Checking (status-on-mount) ───────────────────────────────
  if (phase === "checking") {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-44" />
        </CardContent>
      </Card>
    );
  }

  // ── Connected state ──────────────────────────────────────────
  if (phase === "connected" || phase === "disconnecting") {
    const disconnecting = phase === "disconnecting";
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
                {connection?.name ?? "WhatsApp Business"}
                {connection?.phoneNumber ? ` · ${connection.phoneNumber}` : ""}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            You’re live. You can reply to customers right away; sending campaigns
            needs an approved message template.
          </p>
          {connection && !connection.phoneRegistered && (
            <p className="text-amber-600">
              We’re finishing your number setup in the background — if sending
              isn’t available yet, give it a minute.
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={disconnect}
            disabled={disconnecting}
            className="gap-2"
          >
            {disconnecting && <Loader2 className="size-4 animate-spin" />}
            {disconnecting ? "Disconnecting…" : "Disconnect WhatsApp"}
          </Button>
          {error && (
            <p role="alert" className="flex items-start gap-2 text-red-600">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Connect card (idle / launching / connecting) ─────────────
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
              {needsReauth ? "Reconnect WhatsApp" : "Connect WhatsApp"}
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                <Sparkles className="size-3" /> Live in a minute
              </span>
            </CardTitle>
            <CardDescription>
              Connect your WhatsApp Business number to message customers from
              Peakhour — keep using your WhatsApp Business app alongside, or
              set up a new number.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {needsReauth && (
          <p role="alert" className="flex items-start gap-2 text-sm text-amber-600">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            Your WhatsApp connection needs to be refreshed. Reconnect below to
            keep messaging.
          </p>
        )}

        <div role="radiogroup" aria-label="How do you want to connect?" className="grid gap-2">
          <button
            type="button"
            role="radio"
            aria-checked={flow === "coexistence"}
            disabled={busy}
            onClick={() => setFlow("coexistence")}
            className={`rounded-md border p-3 text-left text-sm transition-colors ${
              flow === "coexistence"
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/50"
            }`}
          >
            <span className="flex items-center gap-2 font-medium text-foreground">
              I already use the WhatsApp Business app
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                Recommended
              </span>
            </span>
            <span className="mt-1 block text-muted-foreground">
              Keep using your app — Peakhour works alongside it on the same
              number. Have your phone handy: you’ll confirm the connection
              from the WhatsApp Business app during setup.
            </span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={flow === "standard"}
            disabled={busy}
            onClick={() => setFlow("standard")}
            className={`rounded-md border p-3 text-left text-sm transition-colors ${
              flow === "standard"
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/50"
            }`}
          >
            <span className="block font-medium text-foreground">
              New or dedicated number
            </span>
            <span className="mt-1 block text-muted-foreground">
              A number that can receive an SMS or call and is{" "}
              <strong className="font-medium text-foreground">not</strong>{" "}
              currently active on the WhatsApp or WhatsApp Business app — Meta
              verifies it in the popup. No account yet? You can create one in
              the same step.
            </span>
          </button>
        </div>

        <Button onClick={launch} disabled={disabled} size="lg" className="gap-2">
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {phase === "connecting" ? "Finishing setup…" : "Opening WhatsApp…"}
            </>
          ) : (
            <>
              <WhatsAppIcon className="size-4" />
              {needsReauth ? "Reconnect WhatsApp" : "Connect WhatsApp"}
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
          <p role="alert" className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="size-4" />
            Couldn’t load the WhatsApp connector. Check your connection and
            refresh.
          </p>
        )}

        {error && (
          <p role="alert" className="flex items-start gap-2 text-sm text-red-600">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
