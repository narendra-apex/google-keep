import { NextResponse } from "next/server";

// Mock data in case API is not reachable or configured
const MOCK_BRANDS = [
  { id: "brand-uuid-001", name: "Acme Retail" },
  { id: "brand-uuid-002", name: "Acme Wholesale" },
];

export async function GET(request: Request) {
  const tenantId = request.headers.get("x-tenant-id");
  const apiUrl = process.env.FOUNDATION_API_URL || "https://api.example.com/v1";

  if (!tenantId) {
    // In a real scenario, we might derive tenant from hostname or user session
    // For now, if no tenant header, we might return error or default to mock
    console.warn("No x-tenant-id header provided");
  }

  try {
    // Attempt to fetch from Foundation API
    // Assuming endpoint GET /brands exists and respects x-tenant-id
    const res = await fetch(`${apiUrl}/brands`, {
      headers: {
        "x-tenant-id": tenantId || "default-tenant",
        "Authorization": request.headers.get("Authorization") || "",
        "Content-Type": "application/json",
      },
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    } else {
      console.warn("Failed to fetch brands from API, falling back to mock", res.status);
      // Fallback to mock data
      return NextResponse.json({ data: MOCK_BRANDS });
    }
  } catch (error) {
    console.error("Error fetching brands:", error);
    return NextResponse.json({ data: MOCK_BRANDS });
  }
}
