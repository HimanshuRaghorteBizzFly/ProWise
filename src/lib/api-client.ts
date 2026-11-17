import { ApiResponse } from "@/types";

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl = "/api") {
    this.baseUrl = baseUrl;
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    // Simulated API response for frontend-only architecture
    return {
      success: true,
      data: null as any,
    };
  }

  async post<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return {
      success: true,
      data: body as T,
    };
  }

  async put<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return {
      success: true,
      data: body as T,
    };
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return {
      success: true,
      data: null as any,
    };
  }
}

export const apiClient = new ApiClient();

