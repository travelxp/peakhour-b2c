"use client";

import { useEffect, useState } from "react";

/**
 * Loads the Facebook JS SDK once and initialises it for WhatsApp Embedded
 * Signup. Returns a load state so callers can gate the Connect button.
 *
 * The SDK version is pinned to v25.0 to match the backend Graph version
 * (helpers/meta.ts); this is also the Graph version Meta's Embedded Signup v4
 * implementation docs recommend (developers.facebook.com/documentation/
 * business-messaging/whatsapp/embedded-signup/implementation/).
 * `appId` comes from NEXT_PUBLIC_META_APP_ID — when it's
 * absent the hook reports "unconfigured" so the UI can render a clear
 * not-set-up state instead of a dead button.
 */

declare global {
  interface Window {
    // The FB SDK is an external global; we only call a narrow slice of it.
    FB?: {
      init: (params: Record<string, unknown>) => void;
      login: (
        cb: (response: FacebookLoginResponse) => void,
        opts: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

export interface FacebookLoginResponse {
  authResponse?: { code?: string; accessToken?: string } | null;
  status?: string;
}

export type FacebookSdkState =
  | "unconfigured"
  | "loading"
  | "ready"
  | "error";

const SDK_SRC = "https://connect.facebook.net/en_US/sdk.js";
const SDK_SCRIPT_ID = "facebook-jssdk";
const GRAPH_VERSION = "v25.0";

// Module-level latch: once the SDK has initialised in this browser session we
// stay ready across component remounts. Kept out of React state (and out of
// `window`) so the lazy initializer below is SSR-safe (false on the server)
// and we never need a synchronous setState inside the effect.
let fbReady = false;

export function useFacebookSdk(appId: string | undefined): FacebookSdkState {
  const [state, setState] = useState<FacebookSdkState>(() =>
    !appId ? "unconfigured" : fbReady ? "ready" : "loading",
  );

  useEffect(() => {
    // Nothing to load: no app id, or the SDK already initialised this session.
    if (!appId || fbReady) return;

    let cancelled = false;

    window.fbAsyncInit = () => {
      try {
        window.FB?.init({
          appId,
          autoLogAppEvents: true,
          xfbml: false,
          version: GRAPH_VERSION,
        });
        fbReady = true;
        if (!cancelled) setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    };

    // Inject the SDK script once. If FB was already present (latch missed,
    // e.g. another loader on the page), initialise via the same callback path
    // on a microtask — never a synchronous setState inside the effect.
    if (window.FB) {
      queueMicrotask(() => window.fbAsyncInit?.());
    } else if (!document.getElementById(SDK_SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SDK_SCRIPT_ID;
      script.src = SDK_SRC;
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.onerror = () => {
        if (!cancelled) setState("error");
      };
      document.body.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, [appId]);

  return state;
}
