interface FetcherOptions extends RequestInit {
  tenantId?: string;
  brandId?: string;
}

export async function fetcher(url: string, options?: FetcherOptions) {
  const { tenantId, brandId, ...rest } = options || {};

  const headers = new Headers(rest.headers);

  // Add tenant and brand context to request
  if (tenantId) {
    headers.set("x-tenant-id", tenantId);
  }
  if (brandId) {
    headers.set("x-brand-id", brandId);
  }

  // Add session cookie if available
  if (typeof document !== "undefined") {
    const cookies = document.cookie.split(";").reduce(
      (acc, cookie) => {
        const [key, value] = cookie.trim().split("=");
        acc[key] = value;
        return acc;
      },
      {} as Record<string, string>
    );

    const sessionId = cookies["session_id"];
    if (sessionId) {
      headers.set("cookie", `session_id=${sessionId}`);
    }
  }

  const response = await fetch(url, {
    ...rest,
    headers,
  });

  if (!response.ok) {
    const error = new Error("Fetch failed");
    (error as any).status = response.status;
    throw error;
  }

  return response.json();
}
