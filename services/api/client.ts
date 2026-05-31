/**
 * API Client
 * Central HTTP client with auth interceptor and error handling.
 * Uses fetch() — no external HTTP library needed.
 */
import { API_BASE_URL } from "./config";
import { tokenStorage } from "./tokenStorage";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  status: number;
  message: string;
  code?: string;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  /** Skip auth token injection (for login/register) */
  skipAuth?: boolean;
  /** Custom timeout in ms (default 15000) */
  timeout?: number;
}

// ─── Error Classes ─────────────────────────────────────────────────────────────

export class ApiRequestError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

export class NetworkError extends Error {
  constructor(message = "Network request failed. Check your connection.") {
    super(message);
    this.name = "NetworkError";
  }
}

// ─── Listeners ─────────────────────────────────────────────────────────────────

type UnauthorizedListener = () => void;
let onUnauthorized: UnauthorizedListener | null = null;

export function setOnUnauthorized(listener: UnauthorizedListener) {
  onUnauthorized = listener;
}

type ErrorReporter = (err: unknown, context?: Record<string, unknown>) => void;
let errorReporter: ErrorReporter | null = null;

export function setApiErrorReporter(reporter: ErrorReporter | null) {
  errorReporter = reporter;
}

// ─── Core Request Function ─────────────────────────────────────────────────────

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {}, skipAuth = false, timeout = 15000 } = options;

  // Build URL
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;

  // Build headers
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...headers,
  };

  // Inject auth token
  let authToken: string | null = null;
  if (!skipAuth) {
    authToken = await tokenStorage.getToken();
    if (authToken) {
      requestHeaders.Authorization = `Bearer ${authToken}`;
    }
  }
  const isAuthenticatedRequest = !skipAuth && Boolean(authToken);

  // Build fetch options
  const fetchOptions: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body && method !== "GET") {
    fetchOptions.body = JSON.stringify(body);
  }

  // Execute with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  fetchOptions.signal = controller.signal;

  let response: Response;

  try {
    response = await fetch(url, fetchOptions);
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      const timeoutErr = new NetworkError("Request timed out. Please try again.");
      errorReporter?.(timeoutErr, { endpoint, method });
      throw timeoutErr;
    }
    const networkErr = new NetworkError();
    errorReporter?.(networkErr, { endpoint, method, raw: err instanceof Error ? err.message : String(err) });
    throw networkErr;
  } finally {
    clearTimeout(timeoutId);
  }

  // ─── Error Handling ────────────────────────────────────────────────────────

  if (!response.ok) {
    let errorMessage = "Something went wrong";
    let errorCode: string | undefined;

    try {
      const errorBody = await response.json();
      errorMessage = errorBody.message || errorBody.error || errorMessage;
      errorCode = errorBody.code;
    } catch {}

    const status = response.status;

    switch (status) {
      case 401:
        if (isAuthenticatedRequest) {
          await tokenStorage.clearTokens();
          onUnauthorized?.();
          throw new ApiRequestError(401, "Session expired. Please log in again.", errorCode);
        }
        throw new ApiRequestError(401, errorMessage || "Please log in to continue.", errorCode);

      case 403:
        throw new ApiRequestError(403, "You don't have permission to perform this action.", errorCode);

      case 423:
        // Account locked/suspended
        throw new ApiRequestError(423, errorMessage || "Your account has been suspended.", errorCode);

      case 429:
        throw new ApiRequestError(429, "Too many requests. Please wait a moment.", errorCode);

      case 500:
      case 502:
      case 503: {
        const serverErr = new ApiRequestError(status, "Server error. Please try again later.", errorCode);
        errorReporter?.(serverErr, { endpoint, method, status, message: errorMessage });
        throw serverErr;
      }

      default:
        throw new ApiRequestError(status, errorMessage, errorCode);
    }
  }

  // ─── Success Response ──────────────────────────────────────────────────────

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const data = await response.json();
  return data as T;
}

// ─── Typed HTTP Methods ────────────────────────────────────────────────────────

export const apiClient = {
  get<T>(endpoint: string, options?: Omit<RequestOptions, "method" | "body">) {
    return request<T>(endpoint, { ...options, method: "GET" });
  },

  post<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) {
    return request<T>(endpoint, { ...options, method: "POST", body });
  },

  put<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) {
    return request<T>(endpoint, { ...options, method: "PUT", body });
  },

  patch<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) {
    return request<T>(endpoint, { ...options, method: "PATCH", body });
  },

  delete<T>(endpoint: string, options?: Omit<RequestOptions, "method" | "body">) {
    return request<T>(endpoint, { ...options, method: "DELETE" });
  },
};
