"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { fetcher } from "@/lib/fetcher";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            queryFn: ({ queryKey }) => {
               // If queryKey is a string, treat it as URL
               // If it's array, assume first item is URL or we need a specific convention
               const url = Array.isArray(queryKey) ? queryKey[0] : queryKey;
               return fetcher(url as string);
            },
            staleTime: 60 * 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
