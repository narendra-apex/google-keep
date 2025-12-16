"use server";

import { cookies } from "next/headers";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/v1";

export interface BrandMetadata {
  tenant_id: string;
  brand_id: string;
  name: string;
  legal_name: string;
  settings: {
    schema_version: string;
    theme?: {
      enabled?: boolean;
      primary_theme?: {
        colors?: {
          primary?: string;
          secondary?: string;
          accent?: string;
          background?: string;
          text?: string;
          success?: string;
          warning?: string;
          error?: string;
        };
        typography?: {
          heading_font?: string;
          body_font?: string;
          heading_size_px?: number;
          body_size_px?: number;
          line_height?: number;
        };
        spacing?: {
          base_unit_px?: number;
          border_radius_px?: number;
        };
        branding?: {
          logo_url?: string;
          logo_alt_text?: string;
          favicon_url?: string;
          banner_url?: string;
          banner_alt_text?: string;
        };
        storefront?: {
          logo_position?: string;
          header_style?: string;
          footer_layout?: string;
          product_image_display?: string;
          product_video_enabled?: boolean;
          show_reviews?: boolean;
          show_related_products?: boolean;
          show_recommended_products?: boolean;
        };
      };
    };
    localization?: {
      default_language?: string;
      default_currency?: string;
      default_timezone?: string;
      supported_languages?: string[];
      supported_currencies?: string[];
    };
    channels?: Record<string, any>;
  };
}

export async function getBrandMetadata(
  brandId: string
): Promise<BrandMetadata> {
  const cookieStore = await cookies();
  const tenantId = cookieStore.get("tenant_id")?.value;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (tenantId) {
    headers["x-tenant-id"] = tenantId;
  }

  const url = `${API_BASE_URL}/brands/${brandId}`;
  const response = await fetch(url, {
    method: "GET",
    headers,
    next: { revalidate: 3600 }, // Cache for 1 hour
  });

  if (!response.ok) {
    // Return default metadata if not found
    console.warn(`Failed to fetch brand ${brandId}: ${response.status}`);
    return getDefaultBrandMetadata(brandId);
  }

  return response.json();
}

export const DEFAULT_BRAND_METADATA: Record<string, BrandMetadata> = {};

export async function getDefaultBrandMetadata(brandId: string): Promise<BrandMetadata> {
  return {
    tenant_id: "default",
    brand_id: brandId,
    name: "Store",
    legal_name: "Store Inc.",
    settings: {
      schema_version: "1.0.0",
      theme: {
        enabled: true,
        primary_theme: {
          colors: {
            primary: "#0066CC",
            secondary: "#FF9900",
            accent: "#00AA44",
            background: "#FFFFFF",
            text: "#333333",
            success: "#00AA44",
            warning: "#FFAA00",
            error: "#CC0000",
          },
          typography: {
            heading_font: "Inter",
            body_font: "Inter",
            heading_size_px: 32,
            body_size_px: 14,
            line_height: 1.5,
          },
          spacing: {
            base_unit_px: 8,
            border_radius_px: 4,
          },
          branding: {
            logo_url: "/logo.png",
            favicon_url: "/favicon.ico",
          },
          storefront: {
            logo_position: "top_left",
            header_style: "sticky",
            footer_layout: "multi_column",
            product_image_display: "carousel",
            product_video_enabled: true,
            show_reviews: true,
            show_related_products: true,
            show_recommended_products: true,
          },
        },
      },
      localization: {
        default_language: "en-US",
        default_currency: "USD",
        default_timezone: "America/New_York",
        supported_languages: ["en-US", "es-ES", "fr-FR"],
        supported_currencies: ["USD", "EUR", "GBP"],
      },
    },
  };
}
