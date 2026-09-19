"use client";

export interface ApiResult<T = any> {
  success: boolean;
  message: string;
  data?: T;
  code?: string;
}

export async function apiFetch<T = any>(url: string, options?: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    credentials: "include"
  });
  const json = await res.json().catch(() => ({ success: false, message: "Unexpected server response" }));
  return json;
}

export function apiGet<T = any>(url: string) {
  return apiFetch<T>(url, { method: "GET" });
}
export function apiPost<T = any>(url: string, body?: unknown) {
  return apiFetch<T>(url, { method: "POST", body: JSON.stringify(body ?? {}) });
}
export function apiPatch<T = any>(url: string, body?: unknown) {
  return apiFetch<T>(url, { method: "PATCH", body: JSON.stringify(body ?? {}) });
}

export function downloadFile(url: string, suggestedName?: string) {
  const a = document.createElement("a");
  a.href = url;
  if (suggestedName) a.download = suggestedName;
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
