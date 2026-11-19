"use client";

import { resolveApiBaseUrl } from "@/lib/api";

export interface OperatorInfo {
  id: string;
  name: string;
  email: string;
  roleId: string;
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
  refreshToken: string;
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

class OperatorAuthService {
  private activeToken: string | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.activeToken = localStorage.getItem("prowise_operator_access_token");
    }
  }

  public setToken(token: string | null) {
    this.activeToken = token;
    if (typeof window !== "undefined") {
      if (token) {
        localStorage.setItem("prowise_operator_access_token", token);
      } else {
        localStorage.removeItem("prowise_operator_access_token");
      }
    }
  }

  public getToken(): string | null {
    if (!this.activeToken && typeof window !== "undefined") {
      this.activeToken = localStorage.getItem("prowise_operator_access_token");
    }
    return this.activeToken;
  }

  private async request<T>(
    endpoint: string,
    options: { method?: string; body?: unknown } = {}
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
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      let errorMessage = `Request failed (${response.status})`;
      try {
        const errorJson = await response.json();
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        // Fallback to status text
      }
      throw new Error(errorMessage);
    }

    return (await response.json()) as T;
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

  public async refresh(): Promise<OperatorAuthResponse> {
    const res = await this.request<OperatorAuthResponse>("/v1/auth/operator/refresh", {
      method: "POST",
    });
    this.setToken(res.accessToken);
    return res;
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

  public async acceptInvitation(
    token: string,
    newPassword: string,
    name?: string
  ): Promise<OperatorAuthResponse> {
    const res = await this.request<OperatorAuthResponse>("/v1/auth/operator/accept-invitation", {
      method: "POST",
      body: { token, newPassword, name },
    });
    this.setToken(res.accessToken);
    return res;
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
}

export const operatorAuthService = new OperatorAuthService();
