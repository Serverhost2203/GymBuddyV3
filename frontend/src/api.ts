// GymBuddy API client. Reads the JWT from secure storage and attaches it.
import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
export const TOKEN_KEY = "gb_token";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T = any>(
  path: string,
  opts: { method?: string; body?: any; auth?: boolean; query?: Record<string, any> } = {},
): Promise<T> {
  const { method = "GET", body, auth = true, query } = opts;
  let url = `${BASE}/api${path}`;
  if (query) {
    const qs = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    if (qs) url += `?${qs}`;
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await storage.secureGet<string>(TOKEN_KEY, "");
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("network", 0);
  }
  if (res.status === 204) return {} as T;
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const detail = (data && (data.detail || data.message)) || "request_failed";
    throw new ApiError(typeof detail === "string" ? detail : "request_failed", res.status);
  }
  return data as T;
}

export const api = {
  get: <T = any>(path: string, query?: Record<string, any>, auth = true) =>
    request<T>(path, { method: "GET", query, auth }),
  post: <T = any>(path: string, body?: any, auth = true) =>
    request<T>(path, { method: "POST", body, auth }),
  put: <T = any>(path: string, body?: any) => request<T>(path, { method: "PUT", body }),
  patch: <T = any>(path: string, body?: any) => request<T>(path, { method: "PATCH", body }),
  del: <T = any>(path: string) => request<T>(path, { method: "DELETE" }),
};
