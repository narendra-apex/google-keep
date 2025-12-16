import { NextRequest } from "next/server";

export interface TenantContext {
  tenantId: string;
  brandId?: string;
}

export function getTenantContext(req: NextRequest): TenantContext {
  // 1. Try hostname (subdomain)
  const hostname = req.headers.get("host") || "";
  // Assuming format: tenant.admin.example.com
  const parts = hostname.split(".");
  let tenantId = "default"; // Fallback
  
  // 2. Try URL params? (Middleware can't easily parse params from NextRequest nextUrl without matching route, but we can look for pattern)
  // But usually params are for specific resources. 
  
  // 3. Cookies
  const cookieTenant = req.cookies.get("tenant_id")?.value;
  const cookieBrand = req.cookies.get("brand_id")?.value;

  // Logic: Cookie overrides hostname? Or hostname is source of truth for tenant?
  // Architecture doc says: "Tenant Context Propagation (API Gateway / Context Middleware)"
  // Usually tenant is determined by domain or auth token.
  
  // For admin portal, we might be logging in as a super admin or a tenant admin.
  // Let's assume cookies are primary for the persistent selection in the switcher.
  
  if (cookieTenant) {
    tenantId = cookieTenant;
  }
  
  return {
    tenantId,
    brandId: cookieBrand
  };
}
