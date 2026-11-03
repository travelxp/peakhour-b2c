"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL, ApiError } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { mediaPath } from "@/lib/inbox-media";

/**
 * Inbox rich messages: open one attachment of a thread.
 *
 * ★A BLOB FETCH WITH THE SESSION, NEVER A LINK. The api route is authenticated and scoped to this business's own threads, so the
 * file cannot be an <img src> or a shareable URL; it is fetched here with the session cookie, held as a blob, and shown through a
 * short-lived object URL that is revoked when the bubble goes. Nothing is fetched until the person presses the button (`enabled`),
 * so opening a thread of fifty photos asks Meta for none of them.
 */

async function fetchBlob(path: string): Promise<{ blob: Blob; filename: string | null }> {
  if (!API_BASE_URL) throw new ApiError("CONFIG_ERROR", "NEXT_PUBLIC_API_URL is not configured", 0);
  // a GET carries no CSRF token; the cookie session is the credential (the same as every other api read here)
  const res = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
  if (!res.ok) {
    let code = "REQUEST_FAILED";
    let message = "Request failed";
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      // a non-JSON refusal is reported by its status below
    }
    throw new ApiError(code, message, res.status);
  }
  const disposition = res.headers.get("content-disposition") ?? "";
  const named = /filename="([^"]*)"/.exec(disposition)?.[1] ?? null;
  return { blob: await res.blob(), filename: named };
}

/** The attachment's bytes, once `enabled`. Cached for the api's own five minutes, then dropped. */
export function useThreadMedia(threadId: string, ref: string, enabled: boolean) {
  const { business } = useAuth();
  return useQuery({
    queryKey: ["wa-media", business?._id ?? "none", threadId, ref],
    queryFn: () => fetchBlob(mediaPath(threadId, ref)),
    enabled: Boolean(business?._id && enabled),
    staleTime: 4 * 60_000,
    gcTime: 5 * 60_000,
    // a refusal is an answer (expired, too large, reconnect), not a blip: asking again is the person's call
    retry: false,
  });
}

/** An object URL for a blob, revoked when the blob changes or the bubble goes. */
export function useObjectUrl(blob: Blob | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    // created and revoked in the same effect, so a re-run (StrictMode, Fast Refresh) makes a fresh URL instead of keeping a revoked one
    const u = blob ? URL.createObjectURL(blob) : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- an object URL is an external resource; this is the sync to it
    setUrl(u);
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [blob]);
  return url;
}
