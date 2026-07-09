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
// Optional Tech Provider Solution id. Created during WhatsApp Tech Provider
// onboarding in the Meta dashboard; ES references it via extras.setup.solutionID
// so the onboarded WABA is tied to our Solution. Unset until onboarding produces
// one — then set NEXT_PUBLIC_META_ES_SOLUTION_ID and it flows through, no code
// change needed. (Twilio's Tech Provider snippet passes this; Meta's Hosted ES
// link for our app currently omits it, so it stays optional.)
const SOLUTION_ID = process.env.NEXT_PUBLIC_META_ES_SOLUTION_ID;

/** How long to wait for the auth code + the per-flow required session ids
 *  (standard: waba + phone; coexistence: waba only) before giving up —
 *  guards against a missed Meta FINISH event leaving the UI spinning
 *  forever. Coexistence gets a much longer leash: its in-popup pairing
 *  step happens ON THE MERCHANT'S PHONE (find phone, update the app,
 *  scan/confirm) and routinely exceeds 90s — a premature watchdog
 *  re-enables Connect while the popup is still open, which is the main
 *  real-world path into stale cross-popup session contamination. */
const WATCHDOG_MS = 90_000;
const COEX_WATCHDOG_MS = 300_000;

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

/** Onboarding surface — drives F5 attribution and (for shopify) the store→
 *  business resolution. */
type ConnectSource = "peakhour" | "shopify" | "wordpress";

/** Result of GET /v1/meta/whatsapp/target-business?shop=… — resolves which
 *  Peakhour business a launched-from store binds to, so the connect can't
 *  land on whatever workspace the dashboard tab last had active. */
interface TargetBusinessResult {
  shop: string;
  isMember: boolean;
  businessId?: string;
  businessName?: string | null;
  matchesActive?: boolean;
}

/** Resolution phases for the store→business lookup (shop flow only). */
type TargetPhase = "na" | "resolving" | "ok" | "not_linked" | "not_member" | "error";

interface TargetState {
  phase: TargetPhase;
  businessId?: string;
  businessName?: string | null;
  matchesActive?: boolean;
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

/** Opt-in verbose tracing for diagnosing Embedded Signup stalls — the popup
 *  completes the captcha but no FINISH message ever arrives, leaving the UI on
 *  the (up to 5-min) watchdog. Toggle with NEXT_PUBLIC_WHATSAPP_ES_DEBUG=1 in
 *  ANY environment, no code change. The watchdog-timeout summary below is
 *  logged regardless (failure-only, one line per stalled attempt) so every
 *  stall leaves an actionable breadcrumb even with tracing off. Never logs the
 *  auth code value (only its length); the WABA/phone ids it does log are the
 *  merchant's own, not secrets. */
const ES_DEBUG = process.env.NEXT_PUBLIC_WHATSAPP_ES_DEBUG === "1";

function esLog(...args: unknown[]) {
  if (ES_DEBUG) console.info("[wa-es]", ...args);
}

/** Per-attempt trace of which ES signals arrived — drives the watchdog hint so
 *  a stall points at its likely cause instead of a generic timeout. */
interface EsDiag {
  startedAt: number;
  flow: ConnectFlow;
  sawCode: boolean;
  sawAnyEsMessage: boolean;
  sawFinish: boolean;
  sawCancel: boolean;
  gotWabaId: boolean;
  gotPhoneNumberId: boolean;
  /** ES-looking messages dropped by the Facebook-origin guard — a real stall
   *  cause (a FINISH arriving from an unexpected origin is silently ignored). */
  droppedEsOrigins: string[];
}

function freshDiag(flow: ConnectFlow): EsDiag {
  return {
    startedAt: Date.now(),
    flow,
    sawCode: false,
    sawAnyEsMessage: false,
    sawFinish: false,
    sawCancel: false,
    gotWabaId: false,
    gotPhoneNumberId: false,
    droppedEsOrigins: [],
  };
}

/** Map the collected signals to the most likely root cause of a stall. The
 *  branches mirror the ES break points: dropped-origin → SDK/proxy origin;
 *  nothing-at-all → Meta app not Live / no Advanced Access / domain not
 *  allowlisted (the usual external-merchant blocker); code-but-no-waba →
 *  payload/flow mismatch; waba-but-no-code → login grant didn't complete. */
function watchdogHint(d: EsDiag): string {
  if (d.droppedEsOrigins.length > 0)
    return "A WhatsApp FINISH message arrived from an unexpected origin and was ignored — check the SDK origin / any proxy in front of facebook.com.";
  if (!d.sawAnyEsMessage && !d.sawCode)
    return "No WhatsApp messages and no auth code arrived. The popup could not complete — verify the Meta app is Live with Advanced Access + Business Verification, and that this domain is allowlisted on the Facebook Login for Business config.";
  if (d.sawCode && !d.gotWabaId)
    return "An auth code arrived but no waba_id in any FINISH event — payload shape or flow mismatch (try the 'New or dedicated number' flow).";
  if (d.gotWabaId && !d.sawCode)
    return "A waba_id arrived but FB.login never returned an auth code — the login grant did not complete.";
  return "Some events arrived but completion never triggered — inspect the [wa-es] trace above.";
}

export function WhatsAppEmbeddedSignup({
  onConnected,
  shop,
  source = "peakhour",
}: {
  onConnected?: (result: ConnectResult) => void;
  /** When launched from a Shopify store (deep link carries ?shop=…): the store
   *  domain, used to resolve + bind the WABA to the store's business rather
   *  than the ambient session business. */
  shop?: string;
  /** F5 attribution surface; also selects the shop-flow behaviour. */
  source?: ConnectSource;
}) {
  const sdkState = useFacebookSdk(APP_ID);
  const configured = Boolean(APP_ID && CONFIG_ID);

  const [phase, setPhase] = useState<Phase>("checking");
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);
  // Store→business resolution (shop flow only). "na" when no shop was passed.
  const [target, setTarget] = useState<TargetState>({
    phase: shop ? "resolving" : "na",
  });
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
  // The popup window FB.login opens, and a poll that watches it for a manual
  // close. Meta does NOT reliably emit a CANCEL message when the user X-closes
  // the ES window, so without this the flow would hang on the watchdog (up to
  // 5 min for coexistence) before the Connect button frees. Mirrors Meta's
  // reference Tech Provider sample (Fbl4bLauncher.tsx).
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Set once the user starts a connect/disconnect — so a slow status-on-mount
  // fetch can't resolve late and clobber a user-initiated transition.
  const interactedRef = useRef(false);
  // Per-attempt diagnostics — reset on each launch(), read by the watchdog to
  // explain a stall. A ref (not state) so updates never re-render mid-flow.
  const diagRef = useRef<EsDiag>(freshDiag("coexistence"));

  // Stop both popup-resolution timers. The watchdog and the close-poll share a
  // lifetime — both exist only while we're waiting on the ES popup — so every
  // existing clearWatchdog() call site also tears the poll down.
  const clearWatchdog = () => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    popupRef.current = null;
  };

  const resetPieces = () => {
    codeRef.current = null;
    sessionRef.current = {};
    completingRef.current = false;
  };

  // ── Shop flow: resolve which business this store binds to. Runs BEFORE
  //    (and instead of) the session-scoped status check, because a store
  //    launched from Shopify may belong to a different workspace than the one
  //    this dashboard tab has active — the session status would reflect the
  //    wrong business. On success the connect binds server-side to this
  //    businessId regardless of the active session business. ──
  useEffect(() => {
    if (!shop) return;
    let cancelled = false;
    (async () => {
      try {
        const t = await api.get<TargetBusinessResult>(
          "/v1/meta/whatsapp/target-business",
          { shop },
        );
        if (cancelled) return;
        if (!t.isMember || !t.businessId) {
          setTarget({ phase: "not_member" });
        } else {
          setTarget({
            phase: "ok",
            businessId: t.businessId,
            businessName: t.businessName ?? null,
            matchesActive: t.matchesActive,
          });
        }
        setPhase("idle");
      } catch (err) {
        if (cancelled) return;
        // 404 = the store isn't linked to Peakhour yet (distinct, actionable);
        // anything else is a transient/unknown failure.
        setTarget({
          phase: err instanceof ApiError && err.code === "STORE_NOT_LINKED"
            ? "not_linked"
            : "error",
        });
        setPhase("idle");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shop]);

  // ── Status on mount: reflect an existing connection instead of always
  //    showing "Connect" (and surface needs-reauth as a repair prompt).
  //    Skipped in the shop flow (session-scoped; would read the wrong
  //    business) — the resolver above drives the phase there. ──
  useEffect(() => {
    if (shop) return;
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
  }, [shop]);

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
          source,
          // Shop flow: bind to the store's business (authorized server-side
          // against org membership), NOT the ambient session business.
          ...(target.businessId ? { businessId: target.businessId } : {}),
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
  }, [onConnected, source, target.businessId]);

  // Capture the WABA + phone ids from Meta's Embedded Signup session-info event.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!isFacebookOrigin(event.origin)) {
        // An ES FINISH arriving from an unexpected origin is dropped here and
        // is a genuine (and otherwise invisible) stall cause — record it so the
        // watchdog summary can flag it instead of reporting a blank timeout.
        try {
          const raw = typeof event.data === "string" ? event.data : "";
          // De-dup + cap: the listener lives for the component's lifetime, so a
          // page spamming ES-looking postMessages must not grow this unbounded
          // or let a stale stray origin outrank the real stall cause in the
          // watchdog hint (which checks droppedEsOrigins first).
          const dropped = diagRef.current.droppedEsOrigins;
          if (
            raw.includes("WA_EMBEDDED_SIGNUP") &&
            dropped.length < 10 &&
            !dropped.includes(event.origin)
          ) {
            dropped.push(event.origin);
            esLog("dropped ES-looking message from non-Facebook origin", event.origin);
          }
        } catch {
          /* ignore — diagnostics only */
        }
        return;
      }
      let payload: { type?: string; event?: string } & Record<string, unknown>;
      try {
        payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (payload?.type !== "WA_EMBEDDED_SIGNUP") return;

      diagRef.current.sawAnyEsMessage = true;
      esLog("event", payload.event ?? "(unnamed)", payload.data ?? {});

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
        diagRef.current.sawCancel = true;
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
          // Sliced to the api zod caps — the route REJECTS oversize bodies
          // (400) rather than truncating, and an oversize Meta blob would
          // silently lose exactly the record support needs.
          void api
            .post("/v1/meta/whatsapp/embedded-signup/failure", {
              sessionId: sessionId.slice(0, 256),
              errorMessage: errorMessage.slice(0, 1024),
              ...(typeof data?.current_step === "string"
                ? { currentStep: data.current_step.slice(0, 128) }
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
        diagRef.current.sawCancel = true;
        esLog("CANCEL (abandoned)", typeof data?.current_step === "string" ? data.current_step : "(no step)");
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
      diagRef.current.sawFinish = true;
      const { wabaId, phoneNumberId } = findSignupIds(payload);
      if (wabaId) {
        sessionRef.current.wabaId = wabaId;
        diagRef.current.gotWabaId = true;
      }
      if (phoneNumberId) {
        sessionRef.current.phoneNumberId = phoneNumberId;
        diagRef.current.gotPhoneNumberId = true;
      }
      esLog("FINISH ids", {
        wabaId: Boolean(wabaId),
        phoneNumberId: Boolean(phoneNumberId),
      });
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
    diagRef.current = freshDiag(flow);
    esLog("launch", { flow, sdkState });

    watchdogRef.current = setTimeout(
      () => {
        if (completingRef.current) return; // POST already started
        clearWatchdog(); // also stops the close-poll — we've given up waiting
        resetPieces();
        setPhase("idle");
        setError("We didn’t hear back from WhatsApp. Please try connecting again.");
        // Failure-only breadcrumb (logged even with tracing off): what arrived,
        // and the most likely cause. Booleans + origins only — no PII.
        const d = diagRef.current;
        console.warn("[wa-es] timed out with no completion", {
          flow: d.flow,
          elapsedMs: Date.now() - d.startedAt,
          sawAnyEsMessage: d.sawAnyEsMessage,
          sawFinish: d.sawFinish,
          sawCancel: d.sawCancel,
          sawCode: d.sawCode,
          gotWabaId: d.gotWabaId,
          gotPhoneNumberId: d.gotPhoneNumberId,
          droppedEsOrigins: d.droppedEsOrigins,
          hint: watchdogHint(d),
        });
      },
      flow === "coexistence" ? COEX_WATCHDOG_MS : WATCHDOG_MS,
    );

    // FB.login opens its popup synchronously via window.open during the call
    // below (popups must open on the user gesture). Briefly wrap window.open to
    // capture that handle, then restore it. We then poll the handle so a manual
    // window close unwinds immediately instead of waiting out the watchdog.
    const originalOpen = window.open;
    window.open = function (...args: Parameters<typeof window.open>) {
      const popup = originalOpen.apply(window, args);
      if (popup) popupRef.current = popup;
      window.open = originalOpen; // restore on first open
      return popup;
    };

    window.FB.login(
      (response: FacebookLoginResponse) => {
        const code = response?.authResponse?.code;
        diagRef.current.sawCode = Boolean(code);
        esLog(
          "FB.login callback",
          code ? `code received (len ${code.length})` : "NO CODE",
          { hadWabaId: Boolean(sessionRef.current.wabaId) },
        );
        if (!code) {
          // FB.login invokes this callback once and it's the ONLY source
          // of the auth code — a code-less callback means completion is
          // permanently impossible, so unwind unconditionally rather than
          // letting the watchdog run out. If FINISH ids already arrived,
          // the grant (not WhatsApp) is what failed — say so.
          clearWatchdog();
          setPhase("idle");
          if (sessionRef.current.wabaId) {
            setError(
              "The authorization didn’t complete. Please try connecting again.",
            );
          }
          resetPieces();
          return;
        }
        codeRef.current = code;
        void complete();
      },
      {
        // ES v4: the flow version is primarily selected by the Facebook Login
        // for Business *configuration* (config_id) — created under App Dashboard
        // → Facebook Login for Business → Configurations with the "WhatsApp
        // Embedded Signup" login variation.
        // (developers.facebook.com/documentation/business-messaging/whatsapp/
        // embedded-signup/versions/ and .../version-4/)
        config_id: CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          // setup carries the Tech Provider Solution when configured (ES ties
          // the onboarded WABA to it via setup.solutionID). Empty until
          // NEXT_PUBLIC_META_ES_SOLUTION_ID is set by Tech Provider onboarding.
          setup: SOLUTION_ID ? { solutionID: SOLUTION_ID } : {},
          // Match the version Meta itself sends in its Hosted ES link for this
          // app (business.facebook.com/messaging/whatsapp/onboard → extras
          // {sessionInfoVersion:"3", version:"v4"}) and in the fbsamples Tech
          // Provider reference. config_id already selects v4; sending it makes
          // our request byte-for-byte match Meta's canonical flow.
          version: "v4",
          // Pin the session-info message format. Meta's implementation doc and
          // the reference Tech Provider sample (ClientDashboard.tsx
          // computeEsConfig) both send sessionInfoVersion "3" — including for
          // v4 — and the WA_EMBEDDED_SIGNUP payload that carries waba_id/
          // phone_number_id is shaped by it. Omitting it lets Meta fall back to
          // a legacy shape, which can break the FINISH-id parse and strand the
          // flow on the watchdog. (Our findSignupIds parse stays
          // shape-tolerant; this just stops the format from drifting.)
          sessionInfoVersion: "3",
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

    // Belt-and-suspenders: restore window.open even if FB.login never opened a
    // popup (e.g. it redirected), so we never leave the global patched.
    window.open = originalOpen;

    // Poll the captured popup. A manual close with no CANCEL message unwinds to
    // idle straight away. Guard on completingRef so a normal post-FINISH close
    // (Meta auto-closes the window on success) doesn't trip a false reset.
    pollRef.current = setInterval(() => {
      if (completingRef.current) return; // the POST owns the outcome now
      if (popupRef.current && popupRef.current.closed) {
        clearWatchdog(); // stops this poll + the watchdog
        resetPieces();
        setPhase("idle");
      }
    }, 500);
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

  // ── Shop flow blocked: can't safely connect until the store resolves to a
  //    workspace the signed-in user owns. Rendered instead of the connect card
  //    so a wrong-workspace bind is impossible. ──
  if (
    shop &&
    (target.phase === "not_linked" ||
      target.phase === "not_member" ||
      target.phase === "error")
  ) {
    const blocked =
      target.phase === "not_linked"
        ? {
            title: "Finish linking your store first",
            body: `${shop} isn’t linked to Peakhour yet. Complete store setup, then connect WhatsApp from your store’s Integrations page.`,
          }
        : target.phase === "not_member"
          ? {
              title: "Sign in with the store’s account",
              body: `You’re signed in with a different Peakhour account than the one that owns ${shop}. Sign in with that account, then reopen “Connect WhatsApp” from your store.`,
            }
          : {
              title: "Couldn’t verify your store",
              body: `We couldn’t confirm which workspace ${shop} belongs to. Please try again in a moment.`,
            };
    return (
      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-amber-500/15">
              <AlertCircle className="size-5 text-amber-600" />
            </span>
            <div>
              <CardTitle className="text-base">{blocked.title}</CardTitle>
              <CardDescription>{blocked.body}</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  // ── Connect card (idle / launching / connecting) ─────────────
  const busy = phase === "launching" || phase === "connecting";
  const disabled = !configured || sdkState !== "ready" || busy;
  // Shop flow must have a resolved target before the button is usable (guards
  // the brief window between mount and the resolver settling).
  const awaitingTarget = Boolean(shop) && target.phase !== "ok";

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
        {/* Shop flow: always show WHICH workspace this binds to. When the
            dashboard's active workspace differs, say so loudly — this is the
            exact silent mis-bind the resolver exists to prevent. */}
        {target.phase === "ok" && (
          <div
            className={`rounded-md border p-3 text-sm ${
              target.matchesActive === false
                ? "border-amber-500/40 bg-amber-500/5 text-amber-700"
                : "border-border bg-muted/40 text-muted-foreground"
            }`}
          >
            {target.matchesActive === false ? (
              <>
                WhatsApp will connect to{" "}
                <strong className="font-medium">
                  {target.businessName ?? "this store’s workspace"}
                </strong>{" "}
                — the workspace this store belongs to. Your dashboard is
                currently in a different workspace; the connection still binds
                to the store’s workspace.
              </>
            ) : (
              <>
                Connecting WhatsApp for{" "}
                <strong className="font-medium text-foreground">
                  {target.businessName ?? "this store’s workspace"}
                </strong>
                .
              </>
            )}
          </div>
        )}

        {needsReauth && (
          <p role="alert" className="flex items-start gap-2 text-sm text-amber-600">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            Your WhatsApp connection needs to be refreshed. Reconnect below to
            keep messaging.
          </p>
        )}

        {/* Toggle buttons (aria-pressed), not ARIA radios — radio semantics
            would promise arrow-key navigation we don't implement.
            role="group" so the aria-label is actually exposed (a generic
            div is naming-prohibited under ARIA 1.2). */}
        <div role="group" aria-label="How do you want to connect?" className="grid gap-2">
          <button
            type="button"
            aria-pressed={flow === "coexistence"}
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
              number. Make sure the app is up to date and the number has been
              in use for at least a week. Have your phone handy: you’ll
              confirm the connection from the WhatsApp Business app during
              setup.
            </span>
          </button>
          <button
            type="button"
            aria-pressed={flow === "standard"}
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

        <Button onClick={launch} disabled={disabled || awaitingTarget} size="lg" className="gap-2">
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

        {busy && (
          <p className="text-sm text-muted-foreground">
            {phase === "launching"
              ? "Complete the steps in the WhatsApp window and keep it open. The coexistence flow asks you to confirm on your phone, so this can take a minute."
              : "Finishing setup…"}
          </p>
        )}

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
