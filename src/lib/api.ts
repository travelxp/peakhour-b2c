const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** Exported for cases where a raw URL is needed (e.g., OAuth redirects) */
export const API_BASE_URL = API_URL;

type FetchOptions = RequestInit & {
  params?: Record<string, string>;
};

let csrfToken: string | null = null;
let csrfFetchPromise: Promise<string | null> | null = null;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Fetch a CSRF token from the server (cached, with dedup guard). Exported so
 * non-ApiClient callers — e.g. the Ask Peakhour `useChat` transport, which POSTs
 * directly to /v1/ask and must set `X-CSRF-Token` itself — reuse the same cache.
 */
export async function getCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken;

  // Deduplicate concurrent fetches
  if (!csrfFetchPromise) {
    csrfFetchPromise = (async () => {
      try {
        const res = await fetch(`${API_URL}/v1/auth/csrf/token`, {
          credentials: "include",
        });
        const json = await res.json();
        if (json.ok && json.data?.csrf_token) {
          csrfToken = json.data.csrf_token;
          return csrfToken;
        }
      } catch {
        // CSRF token fetch is best-effort
      }
      return null;
    })();
  }

  try {
    return await csrfFetchPromise;
  } finally {
    csrfFetchPromise = null;
  }
}

/** Clear the cached CSRF token (e.g. after a CSRF rejection). */
export function clearCsrfToken(): void {
  csrfToken = null;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async request<T>(path: string, options: FetchOptions = {}): Promise<T> {
    if (!this.baseUrl) {
      throw new ApiError(
        "CONFIG_ERROR",
        "NEXT_PUBLIC_API_URL is not configured",
        0
      );
    }

    const { params, ...fetchOptions } = options;

    let url = `${this.baseUrl}${path}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const method = (fetchOptions.method || "GET").toUpperCase();
    const headers: Record<string, string> = {};

    // Only set Content-Type when there's a body
    if (fetchOptions.body) {
      headers["Content-Type"] = "application/json";
    }

    // Merge any caller-provided headers
    if (fetchOptions.headers) {
      const h = fetchOptions.headers;
      if (h instanceof Headers) {
        h.forEach((v, k) => { headers[k] = v; });
      } else if (Array.isArray(h)) {
        h.forEach(([k, v]) => { headers[k] = v; });
      } else {
        Object.assign(headers, h);
      }
    }

    // Add CSRF token for state-changing requests
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      const token = await getCsrfToken();
      if (token) {
        headers["X-CSRF-Token"] = token;
      }
    }

    const res = await fetch(url, {
      credentials: "include",
      ...fetchOptions,
      headers,
    });

    let json: Record<string, unknown>;
    try {
      json = await res.json();
    } catch {
      throw new ApiError(
        "PARSE_ERROR",
        `Server returned non-JSON response (${res.status})`,
        res.status
      );
    }

    if (!res.ok || !json.ok) {
      const error =
        (json.error as { code?: string; message?: string; details?: unknown }) || {
          message: "Request failed",
        };

      // A retry SUPERSEDES the first response. When one happens and still
      // fails, the error we throw must describe the RETRY — otherwise the
      // request id we hand the user points at a log showing only the CSRF
      // rejection or the 401, not the failure they actually hit.
      let finalRes = res;
      let finalJson = json;

      // If CSRF token was rejected, clear cache and retry once
      if (
        (error.code === "CSRF_INVALID" || error.code === "CSRF_MISSING") &&
        method !== "GET"
      ) {
        clearCsrfToken();
        const retryToken = await getCsrfToken();
        if (retryToken) {
          headers["X-CSRF-Token"] = retryToken;
          const retryRes = await fetch(url, {
            credentials: "include",
            ...fetchOptions,
            headers,
          });
          try {
            const retryJson = (await retryRes.json()) as Record<string, unknown>;
            if (retryRes.ok && retryJson.ok) {
              return retryJson.data as T;
            }
            finalRes = retryRes;
            finalJson = retryJson;
          } catch {
            // Non-JSON on the retry — keep the ORIGINAL server error.
            // Letting the SyntaxError escape here would discard the only
            // useful diagnosis.
          }
        }
      }

      // Auto-refresh on 401: call /auth/refresh to renew access_token, then retry once
      if (finalRes.status === 401 && !path.includes("/auth/refresh")) {
        const refreshed = await this.tryRefresh();
        if (refreshed) {
          // Retry the original request with fresh access_token cookie
          const retryRes = await fetch(url, {
            credentials: "include",
            ...fetchOptions,
            headers,
          });
          try {
            const retryJson = (await retryRes.json()) as Record<string, unknown>;
            if (retryRes.ok && retryJson.ok) {
              return retryJson.data as T;
            }
            finalRes = retryRes;
            finalJson = retryJson;
          } catch {
            // Keep whatever we had — see above.
          }
        }
      }

      const errorEnvelope =
        (finalJson.error as {
          code?: string;
          message?: string;
          details?: unknown;
        }) || error;

      throw new ApiError(
        errorEnvelope.code || "UNKNOWN",
        errorEnvelope.message || "Request failed",
        finalRes.status,
        requestIdOf(finalJson),
        errorEnvelope.details
      );
    }

    return json.data as T;
  }

  /** Attempt to refresh the access_token using the refresh_token cookie. Deduped. */
  private async tryRefresh(): Promise<boolean> {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          const res = await fetch(`${this.baseUrl}/v1/auth/refresh`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          });
          return res.ok;
        } catch {
          return false;
        } finally {
          refreshPromise = null;
        }
      })();
    }
    return refreshPromise;
  }

  get<T>(path: string, params?: Record<string, string>) {
    return this.request<T>(path, { method: "GET", params });
  }

  /**
   * GET that also returns the response envelope's `meta` (pagination etc.).
   * Mirrors request()'s 401-refresh + error handling and throws ApiError,
   * unlike a raw fetch — so list views keep auto-refresh + typed errors.
   */
  async getWithMeta<T>(
    path: string,
    params?: Record<string, string>,
  ): Promise<{ data: T; meta: Record<string, unknown> }> {
    if (!this.baseUrl) {
      throw new ApiError("CONFIG_ERROR", "NEXT_PUBLIC_API_URL is not configured", 0);
    }
    let url = `${this.baseUrl}${path}`;
    if (params) url += `?${new URLSearchParams(params).toString()}`;
    const doFetch = () => fetch(url, { credentials: "include" });

    let res = await doFetch();
    if (res.status === 401 && !path.includes("/auth/refresh")) {
      const refreshed = await this.tryRefresh();
      if (refreshed) res = await doFetch();
    }

    let json: Record<string, unknown>;
    try {
      json = (await res.json()) as Record<string, unknown>;
    } catch {
      throw new ApiError("PARSE_ERROR", `Server returned non-JSON response (${res.status})`, res.status);
    }
    if (!res.ok || !json.ok) {
      const error =
        (json.error as { code?: string; message?: string; details?: unknown }) || {
          message: "Request failed",
        };
      throw new ApiError(
        error.code || "UNKNOWN",
        error.message || "Request failed",
        res.status,
        requestIdOf(json),
        error.details
      );
    }
    return { data: json.data as T, meta: (json.meta as Record<string, unknown>) ?? {} };
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: "DELETE" });
  }

  /**
   * POST multipart/form-data (file uploads). Unlike post(), this does NOT
   * set Content-Type — the browser sets the multipart boundary itself.
   * Handles CSRF + a single 401-refresh retry like request().
   */
  async postForm<T>(path: string, form: FormData): Promise<T> {
    if (!this.baseUrl) {
      throw new ApiError("CONFIG_ERROR", "NEXT_PUBLIC_API_URL is not configured", 0);
    }
    const headers: Record<string, string> = {};
    const token = await getCsrfToken();
    if (token) headers["X-CSRF-Token"] = token;

    const doFetch = () =>
      fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        credentials: "include",
        headers,
        body: form,
      });

    let res = await doFetch();
    if (res.status === 401 && !path.includes("/auth/refresh")) {
      const refreshed = await this.tryRefresh();
      if (refreshed) res = await doFetch();
    }

    let json: Record<string, unknown>;
    try {
      json = (await res.json()) as Record<string, unknown>;
    } catch {
      throw new ApiError("PARSE_ERROR", `Server returned non-JSON response (${res.status})`, res.status);
    }
    if (!res.ok || !json.ok) {
      const error =
        (json.error as { code?: string; message?: string; details?: unknown }) || {
          message: "Upload failed",
        };
      throw new ApiError(
        error.code || "UNKNOWN",
        error.message || "Upload failed",
        res.status,
        requestIdOf(json),
        error.details
      );
    }
    return json.data as T;
  }

  /**
   * POST that returns a raw Response for SSE streaming.
   * Handles CSRF + credentials like other methods, but
   * does NOT parse JSON — caller reads the stream.
   */
  async streamPost(path: string, body?: unknown): Promise<Response> {
    const method = "POST";
    const headers: Record<string, string> = {};
    if (body) headers["Content-Type"] = "application/json";

    const token = await getCsrfToken();
    if (token) headers["X-CSRF-Token"] = token;

    const fetchOpts: RequestInit = {
      method,
      credentials: "include",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    };

    let res = await fetch(`${this.baseUrl}${path}`, fetchOpts);

    // Retry on CSRF rejection (same as request())
    if (res.status === 403) {
      const errJson = (await res.clone().json().catch(() => null)) as
        | { error?: { code?: string } }
        | null;
      const code = errJson?.error?.code;
      if (code === "CSRF_INVALID" || code === "CSRF_MISSING") {
        clearCsrfToken();
        const retryToken = await getCsrfToken();
        if (retryToken) {
          (fetchOpts.headers as Record<string, string>)["X-CSRF-Token"] = retryToken;
          res = await fetch(`${this.baseUrl}${path}`, fetchOpts);
        }
      }
    }

    // Auto-refresh on 401 (same as request())
    if (res.status === 401) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        res = await fetch(`${this.baseUrl}${path}`, fetchOpts);
      }
    }

    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as
        | { error?: { code?: string; message?: string; details?: unknown } }
        | null;
      const error = json?.error;
      throw new ApiError(
        error?.code || "STREAM_ERROR",
        error?.message || `Request failed (${res.status})`,
        res.status,
        requestIdOf(json as Record<string, unknown> | null)
      );
    }

    return res;
  }
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    /**
     * `meta.request_id` from the api envelope, when the response had
     * one. The api puts it on EVERY response and logs the full provider
     * detail against it, so this is the handle that lets support find
     * what actually went wrong — without us rendering raw provider text
     * (which can carry internal ids and config names) to the user.
     */
    public requestId?: string,
    /**
     * `error.details` from the api envelope, verbatim.
     *
     * ★Structured 409s carry the caller's next decision in here, not just prose:
     * the LinkedIn Page toggle refuses with QUEUED_POSTS_AFFECTED and returns the
     * scheduled posts the change would break, so the dialog can list them and
     * offer a choice. Dropping details on the floor — as this class did — left a
     * client with nothing but a message string and no way to act on it.
     *
     * `unknown` on purpose: the shape is per-code, and each caller narrows the
     * one it asked for rather than this class pretending to know them all.
     */
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Pull `meta.request_id` out of a parsed api envelope, if present. */
function requestIdOf(json: Record<string, unknown> | null | undefined): string | undefined {
  const meta = json?.meta as { request_id?: unknown } | undefined;
  return typeof meta?.request_id === "string" && meta.request_id !== "unknown"
    ? meta.request_id
    : undefined;
}

export const api = new ApiClient(API_URL);
