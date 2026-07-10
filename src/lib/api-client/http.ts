export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, text || res.statusText);
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
