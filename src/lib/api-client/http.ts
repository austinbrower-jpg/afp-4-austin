export class ApiError extends Error {
  status: number;
  code: string | null;
  details: string[];
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
    this.code = null;
    this.details = [];
  }

  static fromResponse(status: number, fallbackMessage: string, payload: unknown, text: string) {
    const error = new ApiError(status, fallbackMessage);
    if (payload && typeof payload === "object") {
      const record = payload as Record<string, unknown>;
      if (typeof record.error === "string" && record.error.trim()) error.message = record.error;
      if (typeof record.code === "string" && record.code.trim()) error.code = record.code;
      if (Array.isArray(record.details)) {
        error.details = record.details.filter((detail): detail is string => typeof detail === "string");
      }
    } else if (text.trim()) {
      error.message = text;
    }
    return error;
  }
}

export async function apiFetch<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    cache: init?.cache ?? "no-store",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    throw ApiError.fromResponse(
      res.status,
      text || res.statusText || "Request failed",
      payload,
      text,
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiGet = <T>(url: string) => apiFetch<T>(url);
export const apiPost = <T>(url: string, body?: unknown) =>
  apiFetch<T>(url, { method: "POST", body: body ? JSON.stringify(body) : undefined });
export const apiPatch = <T>(url: string, body?: unknown) =>
  apiFetch<T>(url, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
export const apiDelete = <T>(url: string) =>
  apiFetch<T>(url, { method: "DELETE" });
