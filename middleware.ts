import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const p = request.nextUrl.pathname;
  if (
    p.startsWith("/_next") ||
    p.startsWith("/api/") ||
    p === "/favicon.ico" ||
    p === "/robots.txt"
  )
    return NextResponse.next();
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
