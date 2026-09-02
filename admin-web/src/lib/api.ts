/**
 * Central API client for admin panel
 * Handles authentication, error handling, request dedupe, and short-lived caching.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://ekiapp-backend.vercel.app/api";

export class APIError extends Error {
  constructor(
    public status: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = "APIError";
  }
}

export class API2FARequiredError extends APIError {
  constructor(message: string = "2FA code required") {
    super(403, message, "2FA_REQUIRED");
    this.name = "API2FARequiredError";
  }
}

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
  twoFactorCode?: string;
  suppressUnauthorizedRedirect?: boolean;
  cacheTtlMs?: number;
  bypassCache?: boolean;
}

interface CacheEntry {
  expiresAt: number;
  data: unknown;
}

class APIClient {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<unknown>>();

  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("admin_token");
  }

  public hasToken(): boolean {
    return Boolean(this.getToken());
  }

  private setToken(token: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem("admin_token", token);
  }

  public clearToken(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem("admin_token");
    this.clearCache();
  }

  private clearCache(): void {
    this.cache.clear();
    this.inflight.clear();
  }

  private getCacheKey(endpoint: string, token: string | null): string {
    return `${token ?? "guest"}:${endpoint}`;
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const token = this.getToken();
    const method = (options.method ?? "GET").toUpperCase();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (options.twoFactorCode) {
      headers["x-2fa-code"] = options.twoFactorCode;
    }

    const url = `${API_BASE_URL}${endpoint}`;
    const cacheKey = this.getCacheKey(endpoint, token);
    const cacheTtlMs = options.cacheTtlMs ?? 15000;

    if (method === "GET" && !options.bypassCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data as T;
      }

      const inflight = this.inflight.get(cacheKey);
      if (inflight) {
        return inflight as Promise<T>;
      }
    } else if (method !== "GET") {
      this.clearCache();
    }

    const runRequest = async (): Promise<T> => {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const contentType = response.headers.get("content-type");
      const isJson = contentType?.includes("application/json");

      if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status}`;
        let errorCode: string | undefined;

        if (isJson) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
            errorCode = errorData.code;

            if (errorCode === "2FA_REQUIRED") {
              throw new API2FARequiredError(errorMessage);
            }
          } catch (error) {
            if (error instanceof API2FARequiredError) throw error;
          }
        }

        switch (response.status) {
          case 400:
            throw new APIError(400, errorMessage || "Invalid request", errorCode);
          case 401:
            this.clearToken();
            if (
              !options.suppressUnauthorizedRedirect &&
              typeof window !== "undefined" &&
              window.location.pathname !== "/login"
            ) {
              window.location.href = "/login";
            }
            throw new APIError(401, "Unauthorized - please login again", errorCode);
          case 403:
            throw new APIError(403, errorMessage || "Forbidden - insufficient permissions", errorCode);
          case 404:
            throw new APIError(404, errorMessage || "Resource not found", errorCode);
          case 409:
            throw new APIError(409, errorMessage || "Conflict - resource already exists", errorCode);
          case 500:
            throw new APIError(500, "Server error - please try again later", errorCode);
          default:
            throw new APIError(response.status, errorMessage, errorCode);
        }
      }

      if (!isJson) {
        return {} as T;
      }

      const data = (await response.json()) as T;
      if (method === "GET" && !options.bypassCache) {
        this.cache.set(cacheKey, {
          expiresAt: Date.now() + cacheTtlMs,
          data,
        });
      }
      return data;
    };

    try {
      const requestPromise = runRequest();
      if (method === "GET" && !options.bypassCache) {
        this.inflight.set(cacheKey, requestPromise as Promise<unknown>);
      }
      return await requestPromise;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw new APIError(0, "Network error - please check your connection");
    } finally {
      if (method === "GET" && !options.bypassCache) {
        this.inflight.delete(cacheKey);
      }
    }
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  async prefetch<T>(endpoint: string, options?: RequestOptions): Promise<void> {
    try {
      await this.get<T>(endpoint, { ...options, suppressUnauthorizedRedirect: true });
    } catch {
      // Warm the cache quietly. We do not want hover/focus prefetches to surface UI errors.
    }
  }

  async post<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }

  async login(email: string, password: string): Promise<{ token: string; user: any }> {
    const response = await this.post<{ token: string; user: any }>("/auth/login", {
      email,
      password,
    });
    this.setToken(response.token);
    return response;
  }

  // GET /auth/me responds { user: {...} } — this used to return that
  // envelope unwrapped as "any", so AuthContext's currentUser.role was
  // always undefined and every page reload was silently treated as a role
  // mismatch, clearing an otherwise perfectly valid token. Unwrap it here,
  // at the one place that's supposed to know the real response shape.
  async getCurrentUser(options?: RequestOptions): Promise<any> {
    const response = await this.get<{ user: any }>("/auth/me", options);
    return response.user;
  }

  logout(): void {
    this.clearToken();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }
}

export const apiClient = new APIClient();
