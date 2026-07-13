import { NextRequest, NextResponse } from "next/server";
import { isBasicAuthorizationValid } from "@/lib/auth/basic-auth";

export function proxy(request: NextRequest) {
  const expectedPassword = process.env.APP_ACCESS_PASSWORD;
  if (!expectedPassword) return NextResponse.next();

  const expectedUsername = process.env.APP_ACCESS_USERNAME || "austin";
  if (isBasicAuthorizationValid(request.headers.get("authorization"), expectedUsername, expectedPassword)) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": 'Basic realm="Battle Bound Branding Client Reporting Portal", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
