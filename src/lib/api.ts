const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

type FetchOptions = RequestInit & {
  params?: Record<string, string>;
};

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

    const res = await fetch(url, {
      credentials: "include", // send httpOnly cookies
      headers: {
        "Content-Type": "application/json",
        ...fetchOptions.headers,
      },
      ...fetchOptions,
    });

    const json = await res.json();

    if (!res.ok || !json.ok) {
      const error = json.error || { message: "Request failed" };
      throw new ApiError(error.code || "UNKNOWN", error.message, res.status);
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
