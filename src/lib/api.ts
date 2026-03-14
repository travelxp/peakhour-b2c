const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

type FetchOptions = RequestInit & {
  params?: Record<string, string>;
};

let csrfToken: string | null = null;

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /** Fetch a CSRF token from the server (cached until page reload) */
  private async getCsrfToken(): Promise<string | null> {
    if (csrfToken) return csrfToken;
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

    // Add CSRF token for state-changing requests
    const method = (fetchOptions.method || "GET").toUpperCase();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(fetchOptions.headers as Record<string, string>),
    };

    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      const token = await this.getCsrfToken();
      if (token) {
        headers["X-CSRF-Token"] = token;
      }
    }

    const res = await fetch(url, {
      credentials: "include", // send httpOnly cookies
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

      // If CSRF token was rejected, clear cache and let next request retry
      if (error.code === "CSRF_INVALID" || error.code === "CSRF_MISSING") {
        csrfToken = null;
      }

      throw new ApiError(error.code || "UNKNOWN", error.message || "Request failed", res.status);
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
  }
}

export const api = new ApiClient(API_URL);
