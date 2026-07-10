import { NextResponse } from "next/server";
import { DataProviderError } from "./provider-types";

export function dataErrorResponse(error: unknown) {
  if (error instanceof DataProviderError) {
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  const message = error instanceof Error ? error.message : "Unexpected data access error.";
  return NextResponse.json(
    { error: message, code: "unexpected", details: [] },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}

export const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" } as const;
