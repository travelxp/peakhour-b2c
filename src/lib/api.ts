const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** Exported for cases where a raw URL is needed (e.g., OAuth redirects) */
export const API_BASE_URL = API_URL;

type FetchOptions = RequestInit & {
  params?: Record<string, string>;
};

let csrfToken: string | null = null;
let csrfFetchPromise: Promise<string | null> | null = null;

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /** Fetch a CSRF token from the server (cached, with dedup guard) */
  private async getCsrfToken(): Promise<string | null> {
    if (csrfToken) return csrfToken;

    // Deduplicate concurrent fetches
    if (!csrfFetchPromise) {
      csrfFetchPromise = (async () => {
        try {
          const res = await fetch(`${this.baseUrl}/v1/auth/csrf/token`, {
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
      const token = await this.getCsrfToken();
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
      const error = (json.error as { code?: string; message?: string }) || {
        message: "Request failed",
      };

      // If CSRF token was rejected, clear cache and retry once
      if (
        (error.code === "CSRF_INVALID" || error.code === "CSRF_MISSING") &&
        method !== "GET"
      ) {
        csrfToken = null;
        const retryToken = await this.getCsrfToken();
        if (retryToken) {
          headers["X-CSRF-Token"] = retryToken;
          const retryRes = await fetch(url, {
            credentials: "include",
            ...fetchOptions,
            headers,
          });
          const retryJson = (await retryRes.json()) as Record<string, unknown>;
          if (retryRes.ok && retryJson.ok) {
            return retryJson.data as T;
          }
        }
      }

      throw new ApiError(
        error.code || "UNKNOWN",
        error.message || "Request failed",
        res.status
      );
    }

    return json.data as T;
  }

  get<T>(path: string, params?: Record<string, string>) {
    return this.request<T>(path, { method: "GET", params });
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

  delete<T>(path: string) {
    return this.request<T>(path, { method: "DELETE" });
  }
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const api = new ApiClient(API_URL);
