import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getTenantContext } from "./lib/tenant-context";

export function middleware(request: NextRequest) {
  const { tenantId, brandId } = getTenantContext(request);
  
  const headers = new Headers(request.headers);
  if (tenantId) {
    headers.set("x-tenant-id", tenantId);
  }
  if (brandId) {
    headers.set("x-brand-id", brandId);
  }

  return NextResponse.next({
    request: {
      headers,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes) -> actually we WANT to match API routes to inject headers
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
