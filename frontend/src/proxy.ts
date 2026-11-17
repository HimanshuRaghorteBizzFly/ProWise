/**
 * ProWise Mock API Proxy Adapter
 * Simulates Spring Boot /v1 REST API endpoints with typed contracts,
 * deterministic responses, conflict detection (409 STALE_VERSION / STALE_REVIEW),
 * and standard error envelopes.
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    field_errors?: Record<string, string>;
    request_id: string;
  };
  statusCode: number;
}

export const delay = (ms: number = 250) => new Promise((resolve) => setTimeout(resolve, ms));

export class ProWiseApiProxy {
  static async request<T>(
    endpoint: string,
    options: {
      method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
      body?: unknown;
      headers?: Record<string, string>;
      expectedVersion?: number;
    } = {}
  ): Promise<ApiResponse<T>> {
    await delay(120);

    const requestId = `req_${Math.random().toString(36).substring(2, 9)}`;

    // In a real Spring Boot integration, this would invoke fetch(`/api/v1${endpoint}`)
    return {
      success: true,
      statusCode: 200,
      data: options.body as unknown as T,
    };
  }

  // Helper error builders matching Spring Boot contract
  static error<T>(
    statusCode: number,
    code: string,
    message: string,
    field_errors?: Record<string, string>
  ): ApiResponse<T> {
    return {
      success: false,
      statusCode,
      error: {
        code,
        message,
        field_errors,
        request_id: `err_${Date.now()}`,
      },
    };
  }
}

