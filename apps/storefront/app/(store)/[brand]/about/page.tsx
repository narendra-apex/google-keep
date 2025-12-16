"use client";

import { BrandMetadata } from "@/lib/server-actions/brands";
import { useEffect, useState } from "react";

export default function AboutPage({ params }: { params: Promise<{ brand: string }> }) {
  const [metadata, setMetadata] = useState<BrandMetadata | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("brand_metadata");
    if (stored) {
      setMetadata(JSON.parse(stored));
    }
  }, []);

  if (!metadata) {
    return <div className="container py-12">Loading...</div>;
  }

  return (
    <div className="container py-12">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-text mb-4">{metadata.name}</h1>
        <p className="text-lg text-gray-600 mb-8">{metadata.legal_name}</p>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-text mb-4">About Us</h2>
          <p className="text-gray-600 mb-4">
            Welcome to {metadata.name}! We're dedicated to providing the best shopping
            experience and high-quality products to our customers.
          </p>
          <p className="text-gray-600">
            Our team is committed to excellence, innovation, and customer satisfaction.
            Thank you for supporting our business!
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-text mb-4">Store Info</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {metadata.settings.localization && (
              <>
                <div>
                  <h3 className="font-semibold text-text mb-2">Language</h3>
                  <p className="text-gray-600">
                    {metadata.settings.localization.default_language}
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-text mb-2">Currency</h3>
                  <p className="text-gray-600">
                    {metadata.settings.localization.default_currency}
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-text mb-2">Timezone</h3>
                  <p className="text-gray-600">
                    {metadata.settings.localization.default_timezone}
                  </p>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
