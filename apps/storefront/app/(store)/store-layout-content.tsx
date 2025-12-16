"use client";

import { useEffect, useState } from "react";
import { BrandProvider } from "@/lib/brand-provider";
import { BrandMetadata, getDefaultBrandMetadata } from "@/lib/server-actions/brands";
import Header from "@/components/header";
import Footer from "@/components/footer";

interface StoreLayoutContentProps {
  children: React.ReactNode;
}

export default function StoreLayoutContent({ children }: StoreLayoutContentProps) {
  const [metadata, setMetadata] = useState<BrandMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const stored = localStorage.getItem("brand_metadata");
        if (stored) {
          setMetadata(JSON.parse(stored));
        } else {
          // Fallback to default
          const defaultMetadata = await getDefaultBrandMetadata("default");
          setMetadata(defaultMetadata);
        }
      } catch (error) {
        console.error("Failed to load brand metadata:", error);
        const defaultMetadata = await getDefaultBrandMetadata("default");
        setMetadata(defaultMetadata);
      } finally {
        setIsLoading(false);
      }
    };

    loadMetadata();
  }, []);

  if (isLoading || !metadata) {
    return <div>Loading...</div>;
  }

  return (
    <BrandProvider metadata={metadata}>
      <html lang="en">
        <head>
          <title>{metadata.name}</title>
          <meta name="description" content={`Shop at ${metadata.name}`} />
          {metadata.settings.theme?.branding?.favicon_url && (
            <link rel="icon" href={metadata.settings.theme.branding.favicon_url} />
          )}
        </head>
        <body>
          <Header brand={metadata} />
          <main className="min-h-screen">{children}</main>
          <Footer brand={metadata} />
        </body>
      </html>
    </BrandProvider>
  );
}
