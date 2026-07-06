/**
 * API Client — wraps fetch with JWT auth and error handling.
 */

import type {
  TokenResponse,
  RegisterRequest,
  LoginRequest,
  User,
  UserUpdateRequest,
  ImageData,
  Analysis,
  AnalysisSummary,
  ChatRequest,
  ChatResponse,
  ChatMessage,
} from "@/types";

export const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000");

// ── Token Management ────────────────────────────────────────

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("refresh_token");
}

export function setTokens(tokens: TokenResponse) {
  localStorage.setItem("access_token", tokens.access_token);
  localStorage.setItem("refresh_token", tokens.refresh_token);
}

export function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

// ── Fetch Wrapper ───────────────────────────────────────────

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData (browser sets boundary automatically)
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && retry && !path.startsWith("/api/auth/")) {
    // Try refresh
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiFetch<T>(path, options, false);
    }
    clearTokens();
    window.location.href = "/auth/login";
    throw new ApiError(401, "Session expired");
  }

  // Redirect unverified users to verify-pending page
  if (res.status === 403 && !path.startsWith("/api/auth/")) {
    const body = await res.json().catch(() => ({ detail: "" }));
    if (body.detail && body.detail.includes("Email not verified")) {
      window.location.href = "/auth/verify-pending";
      throw new ApiError(403, "Email not verified");
    }
    throw new ApiError(res.status, body.detail || "Forbidden");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new ApiError(res.status, body.detail || JSON.stringify(body));
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });

    if (!res.ok) return false;
    const tokens: TokenResponse = await res.json();
    setTokens(tokens);
    return true;
  } catch {
    return false;
  }
}

// ── Auth API ────────────────────────────────────────────────

export async function register(data: RegisterRequest): Promise<TokenResponse> {
  const tokens = await apiFetch<TokenResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
  setTokens(tokens);
  return tokens;
}

export async function login(data: LoginRequest): Promise<TokenResponse> {
  const tokens = await apiFetch<TokenResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
  setTokens(tokens);
  return tokens;
}

export function logout() {
  clearTokens();
}

// ── Email Verification API ──────────────────────────────────

export async function verifyEmail(token: string): Promise<{ message: string; already_verified: boolean }> {
  return apiFetch<{ message: string; already_verified: boolean }>(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
}

export async function resendVerification(): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/api/auth/resend-verification", {
    method: "POST",
  });
}

export async function checkVerificationStatus(): Promise<{ email_verified: boolean; email: string }> {
  return apiFetch<{ email_verified: boolean; email: string }>("/api/auth/verification-status");
}

// ── User API ────────────────────────────────────────────────

export async function getProfile(): Promise<User> {
  return apiFetch<User>("/api/users/me");
}

export async function updateProfile(data: UserUpdateRequest): Promise<User> {
  return apiFetch<User>("/api/users/me", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteAccount(): Promise<void> {
  return apiFetch<void>("/api/users/me", { method: "DELETE" });
}

// ── Images API ──────────────────────────────────────────────

export async function uploadImage(file: File): Promise<ImageData> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<ImageData>("/api/images", {
    method: "POST",
    body: formData,
  });
}

export async function listImages(): Promise<ImageData[]> {
  return apiFetch<ImageData[]>("/api/images");
}

export async function deleteImage(id: string): Promise<void> {
  return apiFetch<void>(`/api/images/${id}`, { method: "DELETE" });
}

// ── Analysis API ────────────────────────────────────────────

export async function createAnalysis(imageId: string, height?: number, weight?: number): Promise<Analysis> {
  const query = [`image_id=${imageId}`];
  if (height) query.push(`height=${height}`);
  if (weight) query.push(`weight=${weight}`);
  return apiFetch<Analysis>(`/api/analysis?${query.join("&")}`, {
    method: "POST",
  });
}

export async function listAnalyses(): Promise<AnalysisSummary[]> {
  return apiFetch<AnalysisSummary[]>("/api/analysis");
}

export async function getAnalysis(id: string): Promise<Analysis> {
  return apiFetch<Analysis>(`/api/analysis/${id}`);
}

export async function updateAnalysisMetrics(id: string, height?: number, weight?: number): Promise<Analysis> {
  return apiFetch<Analysis>(`/api/analysis/${id}/metrics`, {
    method: "PATCH",
    body: JSON.stringify({ height, weight }),
  });
}

// ── Assistant API ───────────────────────────────────────────

export async function sendChatMessage(data: ChatRequest): Promise<ChatResponse> {
  return apiFetch<ChatResponse>("/api/assistant/chat", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getChatHistory(analysisId?: string, limit = 50): Promise<ChatMessage[]> {
  const query = analysisId ? `?analysis_id=${analysisId}&limit=${limit}` : `?limit=${limit}`;
  return apiFetch<ChatMessage[]>(`/api/assistant/history${query}`);
}

// ── Utility ─────────────────────────────────────────────────

export function getImageUrl(path: string): string {
  // Convert server file path to URL
  const relativePath = path.replace(/\\/g, "/").split("uploads/").pop();
  return `${API_URL}/uploads/${relativePath}`;
}

export { ApiError };
