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

export interface ApiFetchInit extends RequestInit {
  timeoutMs?: number;
}

export async function apiFetch<T>(
  input: string,
  init?: ApiFetchInit,
): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const controller = new AbortController();
  const externalSignal = init?.signal;
  const { timeoutMs, ...fetchInit } = init ?? {};
  let timedOut = false;
  const abortFromCaller = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) abortFromCaller();
  else externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = timeoutMs
    ? setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs)
    : null;

  let res: Response;
  try {
    res = await fetch(input, {
      ...fetchInit,
      signal: controller.signal,
      cache: method === "GET" ? init?.cache ?? "no-store" : init?.cache,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch (error) {
    if (timedOut) {
      const timeoutError = new ApiError(408, "The request took too long. Please try again.");
      timeoutError.code = "timeout";
      throw timeoutError;
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromCaller);
  }

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

export const apiGet = <T>(url: string, init?: ApiFetchInit) => apiFetch<T>(url, init);
export const apiPost = <T>(url: string, body?: unknown) =>
  apiFetch<T>(url, { method: "POST", body: body ? JSON.stringify(body) : undefined });
export const apiPatch = <T>(url: string, body?: unknown) =>
  apiFetch<T>(url, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
export const apiDelete = <T>(url: string) =>
  apiFetch<T>(url, { method: "DELETE" });
