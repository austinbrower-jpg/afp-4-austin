import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiGet, apiPost, ApiError } from "./http";

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("api client cache control", () => {
  it("forces no-store on GET requests", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await apiGet("/api/hours");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/hours",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("preserves caller-provided fetch options", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ ok: true }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await apiPost("/api/hours", { ok: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/hours",
      expect.not.objectContaining({ cache: "no-store" }),
    );
  });

  it("parses structured API errors without exposing secrets", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: async () =>
        JSON.stringify({
          error: "Notion configuration is missing",
          code: "configuration",
          details: ["NOTION_API_KEY"],
        }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiGet("/api/hours")).rejects.toMatchObject({
      status: 503,
      code: "configuration",
      details: ["NOTION_API_KEY"],
      message: "Notion configuration is missing",
    } as Partial<ApiError>);
  });

  it("turns a bounded request timeout into a retryable API error", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_input: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
    ));

    const request = apiGet("/api/report-builder", { timeoutMs: 100 });
    const expectation = expect(request).rejects.toMatchObject({ status: 408, code: "timeout" });
    await vi.advanceTimersByTimeAsync(100);

    await expectation;
  });
});
