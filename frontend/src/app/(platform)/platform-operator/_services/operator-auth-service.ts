"use client";

import { resolveApiBaseUrl } from "@/lib/api";

/**
 * The API reads and writes snake_case JSON (Jackson SNAKE_CASE); this client and its callers use camelCase.
 * Request bodies are converted to snake_case and responses to camelCase in one place, so a field such as
 * `authorized_modules` can never silently arrive as `undefined` (it used to break the operator sign-in page).
 */
export function toSnakeCaseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toSnakeCaseKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, inner]) => [
        key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
        toSnakeCaseKeys(inner),
      ]),
    );
  }
  return value;
}

export function toCamelCaseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toCamelCaseKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, inner]) => [
        key.replace(/_([a-z0-9])/g, (_match, letter: string) => letter.toUpperCase()),
        toCamelCaseKeys(inner),
      ]),
    );
  }
  return value;
}

export interface OperatorInfo {
  id: string;
  name: string;
  email: string;
  roleId: string;
  accessLevel?: string;
  departmentId: string;
  departmentName: string;
  status: string;
  mfaEnabled: boolean;
  onCall: boolean;
  shiftName: string;
  lastLoginAt?: string;
  createdAt?: string;
}

export interface OperatorAuthResponse {
  accessToken: string;
  /* No refreshToken: it lives only in the HttpOnly cookie; the client never reads one from a body. */
  tokenType: string;
  expiresIn: number;
  operator: OperatorInfo;
  authorizedModules: string[];
  effectivePermissions: string[];
}

export interface NavigationModuleItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  authorized: boolean;
}

export interface NavigationSection {
  title: string;
  items: NavigationModuleItem[];
}

export interface OperatorNavigationResponse {
  operatorId: string;
  department: string;
  sections: NavigationSection[];
}

export interface DashboardMetric {
  label: string;
  value: string;
  change: string;
  tone: string;
}

export interface OperatorDashboardResponse {
  department: string;
  departmentName: string;
  kpis: DashboardMetric[];
  authorizedModules: string[];
  departmentData: Record<string, unknown>;
}

/** Older builds kept the operator access token here; it is removed on load and never written again. */
const LEGACY_TOKEN_STORAGE_KEY = "prowise_operator_access_token";

/**
 * sessionStorage key used when the main /login page accepts an operator's emailed temporary password and hands the
 * operator to /operator/login to choose a new one. The operator page removes it as soon as it reads it.
 */
export const OPERATOR_FIRST_LOGIN_KEY = "prowise_operator_first_login";

/** Thrown for a non-2xx answer; keeps the HTTP status so a 401 can be told apart. */
export class OperatorApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "OperatorApiError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Operator API client. The access token lives in memory only (never localStorage); the refresh token lives only
 * in the HttpOnly cookie the backend sets. After a page load the first call goes out with the cookies alone, and a
 * 401 triggers one cookie-based refresh (/v1/auth/operator/refresh) and a single retry.
 */
export class OperatorAuthService {
  private activeToken: string | null = null;
  private refreshing: Promise<OperatorAuthResponse> | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        window.localStorage?.removeItem(LEGACY_TOKEN_STORAGE_KEY);
      } catch {
        /* storage unavailable: nothing to clean up */
      }
    }
  }

  public setToken(token: string | null) {
    this.activeToken = token;
  }

  public getToken(): string | null {
    return this.activeToken;
  }

  private async request<T>(
    endpoint: string,
    options: { method?: string; body?: unknown; retryOnUnauthorized?: boolean } = {}
  ): Promise<T> {
    const baseUrl = resolveApiBaseUrl();
    const headers = new Headers({
      Accept: "application/json",
    });

    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    const token = this.getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: options.method || "GET",
      headers,
      credentials: "include",
      body: options.body !== undefined ? JSON.stringify(toSnakeCaseKeys(options.body)) : undefined,
    });

    // Sign-in, refresh and the other /auth/operator/* calls answer 401 for real; only API calls refresh.
    const mayRefresh = options.retryOnUnauthorized !== false && !endpoint.startsWith("/v1/auth/operator/");
    if (response.status === 401 && mayRefresh) {
      const refreshed = await this.refresh().catch(() => null);
      if (refreshed) {
        return this.request<T>(endpoint, { ...options, retryOnUnauthorized: false });
      }
    }

    if (!response.ok) {
      let errorMessage = `Request failed (${response.status})`;
      let code = `HTTP_${response.status}`;
      try {
        const errorJson = await response.json();
        errorMessage = errorJson.message || errorJson.error || errorMessage;
        code = errorJson.code || code;
      } catch {
        // Fallback to status text
      }
      throw new OperatorApiError(response.status, code, errorMessage);
    }

    return toCamelCaseKeys(await response.json()) as T;
  }

  public async login(
    email: string,
    password: string,
    rememberMe = false
  ): Promise<OperatorAuthResponse> {
    const res = await this.request<OperatorAuthResponse>("/v1/auth/operator/login", {
      method: "POST",
      body: { email, password, rememberMe },
    });
    this.setToken(res.accessToken);
    return res;
  }

  /**
   * Rotates the session using the HttpOnly refresh cookie only (no token in the body). Concurrent callers share one
   * call. On failure the in-memory token is cleared and the promise rejects; callers route to /login.
   */
  public refresh(): Promise<OperatorAuthResponse> {
    if (!this.refreshing) {
      this.refreshing = this.request<OperatorAuthResponse>("/v1/auth/operator/refresh", {
        method: "POST",
        retryOnUnauthorized: false,
      })
        .then((res) => {
          if (!res?.accessToken) throw new OperatorApiError(401, "UNAUTHORIZED", "Your session has ended. Sign in again.");
          this.setToken(res.accessToken);
          return res;
        })
        .catch((error: unknown) => {
          this.setToken(null);
          throw error;
        })
        .finally(() => {
          this.refreshing = null;
        });
    }
    return this.refreshing;
  }

  public async logout(): Promise<void> {
    try {
      await this.request<{ message: string }>("/v1/auth/operator/logout", {
        method: "POST",
      });
    } finally {
      this.setToken(null);
    }
  }

  public async forgotPassword(email: string): Promise<string> {
    const res = await this.request<{ message: string }>("/v1/auth/operator/forgot-password", {
      method: "POST",
      body: { email },
    });
    return res.message;
  }

  public async resetPassword(token: string, newPassword: string): Promise<string> {
    const res = await this.request<{ message: string }>("/v1/auth/operator/reset-password", {
      method: "POST",
      body: { token, newPassword },
    });
    return res.message;
  }

  /**
   * Accepts a 72-hour single-use invitation and sets the operator's own password.
   * No token is kept here; the operator signs in afterwards.
   */
  public async acceptInvitation(token: string, newPassword: string, name?: string): Promise<void> {
    await this.request<unknown>("/v1/auth/operator/accept-invitation", {
      method: "POST",
      body: { token, newPassword, name },
    });
  }

  public async getProfile(): Promise<OperatorInfo> {
    return this.request<OperatorInfo>("/v1/operator/me");
  }

  public async getNavigation(): Promise<OperatorNavigationResponse> {
    return this.request<OperatorNavigationResponse>("/v1/operator/navigation");
  }

  public async getDashboard(): Promise<OperatorDashboardResponse> {
    return this.request<OperatorDashboardResponse>("/v1/operator/dashboard");
  }

  /** Real email delivery log (read-only for operators; SMTP settings stay Super Admin only). */
  public async listEmailDeliveries(status?: string): Promise<OperatorEmailDelivery[]> {
    const query = status && status !== "ALL" ? `?status=${encodeURIComponent(status)}` : "";
    return this.request<OperatorEmailDelivery[]>(`/v1/operator/email/delivery${query}`);
  }
}

export interface OperatorEmailDelivery {
  id: string;
  recipient: string;
  subject: string;
  provider: string | null;
  status: string;
  attempts: number;
  errorCode: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
}

export const operatorAuthService = new OperatorAuthService();
