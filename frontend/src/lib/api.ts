import type { ApiErrorResponse, HealthResponse } from "@/types/api";

export const REQUEST_ID_HEADER = "X-Request-Id";
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";
export const EXPECTED_VERSION_FIELD = "expectedVersion";

type FetchLike = typeof globalThis.fetch;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string;
  readonly fieldErrors: ApiErrorResponse["field_errors"];

  constructor(
    status: number,
    code: string,
    message: string,
    requestId: string,
    fieldErrors: ApiErrorResponse["field_errors"] = [],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.fieldErrors = fieldErrors;
  }
}

export function resolveApiBaseUrl(configuredUrl = process.env.NEXT_PUBLIC_API_BASE_URL): string {
  if (!configuredUrl?.trim()) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is required; see frontend/.env.example.");
  }
  return configuredUrl.replace(/\/+$/, "");
}

export interface ApiClientOptions {
  baseUrl?: string;
  fetch?: FetchLike;
}

export function createApiClient(options: ApiClientOptions = {}) {
  const fetcher = options.fetch ?? globalThis.fetch;
  let accessToken: string | null = null;
  let refreshing: Promise<string | null> | null = null;

  async function health(): Promise<HealthResponse> {
    const response = await request("/v1/health", { retryOnUnauthorized: false });
    return (await response.json()) as HealthResponse;
  }

  async function request(
    path: string,
    requestOptions: { method?: string; body?: unknown; retryOnUnauthorized?: boolean } = {},
  ): Promise<Response> {
    let response: Response;
    try {
      const headers = new Headers({ Accept: "application/json" });
      if (requestOptions.body !== undefined) headers.set("Content-Type", "application/json");
      if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
      response = await fetcher(`${resolveApiBaseUrl(options.baseUrl)}${path}`, {
        method: requestOptions.method ?? "GET",
        headers,
        credentials: "include",
        body: requestOptions.body === undefined ? undefined : JSON.stringify(requestOptions.body),
      });
    } catch (error) {
      throw new ApiError(0, "NETWORK_ERROR", error instanceof Error ? error.message : "Network request failed.", "");
    }

    if (response.status === 401 && requestOptions.retryOnUnauthorized !== false) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return request(path, { ...requestOptions, retryOnUnauthorized: false });
      }
    }
    if (!response.ok) {
      throw await toApiError(response);
    }
    return response;
  }

  async function json<T>(path: string, requestOptions: { method?: string; body?: unknown } = {}): Promise<T> {
    const response = await request(path, requestOptions);
    return (await response.json()) as T;
  }

  async function refreshAccessToken(): Promise<string | null> {
    if (!refreshing) {
      refreshing = json<{ access_token: string }>("/v1/auth/refresh", {
        method: "POST",
      })
        .then((tokens) => {
          accessToken = tokens.access_token;
          return accessToken;
        })
        .catch(() => {
          accessToken = null;
          return null;
        })
        .finally(() => {
          refreshing = null;
        });
    }
    return refreshing;
  }

  return {
    health,
    signup: (body: { email: string; password: string; name?: string }) =>
      json<{ access_token: string }>("/v1/auth/signup", { method: "POST", body }).then((tokens) => {
        accessToken = tokens.access_token;
        return tokens;
      }),
    signin: (body: { email: string; password: string }) =>
      json<{ access_token: string }>("/v1/auth/signin", { method: "POST", body }).then((tokens) => {
        accessToken = tokens.access_token;
        return tokens;
      }),
    refresh: refreshAccessToken,
    signout: async () => {
      await request("/v1/auth/signout", { method: "POST" });
      accessToken = null;
    },
    me: () => json<import("@/types/api").MeResponse>("/v1/me"),
    requestPasswordReset: (email: string) =>
      request("/v1/auth/password-reset/request", { method: "POST", body: { email } }),
    confirmPasswordReset: (token: string, password: string) =>
      request("/v1/auth/password-reset/confirm", { method: "POST", body: { token, password } }),
    createOrganization: (body: {
      name: string;
      slug: string;
      timezone: string;
      calendar: unknown;
    }) => json<import("@/types/api").OrganizationResponse>("/v1/organizations", { method: "POST", body }),
  };
}

export const apiClient = createApiClient();

async function toApiError(response: Response): Promise<ApiError> {
  const requestId = response.headers.get(REQUEST_ID_HEADER) ?? "";
  let body: Partial<ApiErrorResponse> = {};
  try {
    body = (await response.json()) as Partial<ApiErrorResponse>;
  } catch {
    // Non-JSON gateway responses still become the standard client error.
  }

  return new ApiError(
    response.status,
    body.code ?? `HTTP_${response.status}`,
    body.message ?? `Request failed with status ${response.status}.`,
    body.request_id ?? requestId,
    body.field_errors ?? [],
  );
}
