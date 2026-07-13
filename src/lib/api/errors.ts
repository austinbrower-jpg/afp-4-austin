import { NextResponse } from "next/server";
import { DataProviderError } from "@/lib/data/provider-types";
export interface ApiErrorBody { error: string; code: string; details: string[]; }
export const API_NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" } as const;
export function formatApiError(error: unknown, fallback = "Unexpected API error."): { body: ApiErrorBody; status: number } {
  if (error instanceof DataProviderError) return { status: error.status, body: { error: error.message, code: error.code, details: error.details } };
  if (error instanceof SyntaxError) return { status: 400, body: { error: "Invalid JSON request body.", code: "invalid-json", details: [] } };
  const message = error instanceof Error && error.message ? error.message : fallback;
  return { status: 500, body: { error: message, code: "unexpected", details: [] } };
}
export function apiErrorResponse(error: unknown, fallback?: string) { const f = formatApiError(error, fallback); return NextResponse.json(f.body, { status: f.status, headers: API_NO_STORE_HEADERS }); }
export function apiValidationError(message: string, details: string[] = []) { return NextResponse.json({ error: message, code: "validation", details }, { status: 400, headers: API_NO_STORE_HEADERS }); }
