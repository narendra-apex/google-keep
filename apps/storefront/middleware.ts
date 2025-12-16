import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // For storefront, we'll use [brand] segment to get brand context
  // Middleware will inject tenant_id and brand_id headers from cookies if available
  
  const headers = new Headers(request.headers);
  
  // Try to get tenant_id from cookie
  const tenantId = request.cookies.get("tenant_id")?.value;
  if (tenantId) {
    headers.set("x-tenant-id", tenantId);
  }
  
  // Try to get brand_id from cookie
  const brandId = request.cookies.get("brand_id")?.value;
  if (brandId) {
    headers.set("x-brand-id", brandId);
  }
  
  // Try to get session cookie for customer authentication
  const sessionId = request.cookies.get("session_id")?.value;
  if (sessionId) {
    headers.set("cookie", `session_id=${sessionId}`);
  }

  return NextResponse.next({
    request: {
      headers,
    },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
