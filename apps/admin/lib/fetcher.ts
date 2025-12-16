export async function fetcher(url: string, options?: RequestInit) {
  const headers = new Headers(options?.headers);
  
  // Read from cookies/storage
  // Note: On server side (prefetching), this won't work directly without passing context.
  // But this fetcher is primarily for client-side queries.
  
  let tenantId, brandId;
  
  if (typeof document !== "undefined") {
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    
    tenantId = cookies['tenant_id'];
    brandId = cookies['selected_brand_id']; // Using the key from tenant-switcher
  }

  if (tenantId) headers.set('x-tenant-id', tenantId);
  if (brandId) headers.set('x-brand-id', brandId);
  
  // Also pass Authorization if available
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    throw new Error(`An error occurred while fetching the data: ${res.statusText}`);
  }

  return res.json();
}
