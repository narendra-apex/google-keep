"use client";

import React, { useEffect } from "react";
import { BrandMetadata } from "./server-actions/brands";

interface BrandProviderProps {
  children: React.ReactNode;
  metadata: BrandMetadata;
}

export function BrandProvider({ children, metadata }: BrandProviderProps) {
  useEffect(() => {
    // Apply theme CSS variables
    const theme = metadata.settings.theme?.primary_theme;
    const root = document.documentElement;

    if (theme?.colors) {
      root.style.setProperty("--color-primary", theme.colors.primary || "#0066CC");
      root.style.setProperty("--color-secondary", theme.colors.secondary || "#FF9900");
      root.style.setProperty("--color-accent", theme.colors.accent || "#00AA44");
      root.style.setProperty("--color-background", theme.colors.background || "#FFFFFF");
      root.style.setProperty("--color-text", theme.colors.text || "#333333");
      root.style.setProperty("--color-success", theme.colors.success || "#00AA44");
      root.style.setProperty("--color-warning", theme.colors.warning || "#FFAA00");
      root.style.setProperty("--color-error", theme.colors.error || "#CC0000");
    }

    if (theme?.typography) {
      root.style.setProperty("--font-heading", theme.typography.heading_font || "Inter");
      root.style.setProperty("--font-body", theme.typography.body_font || "Inter");
      root.style.setProperty(
        "--font-size-heading",
        `${theme.typography.heading_size_px || 32}px`
      );
      root.style.setProperty(
        "--font-size-body",
        `${theme.typography.body_size_px || 14}px`
      );
      root.style.setProperty(
        "--line-height",
        `${theme.typography.line_height || 1.5}`
      );
    }

    if (theme?.spacing) {
      root.style.setProperty(
        "--spacing-unit",
        `${theme.spacing.base_unit_px || 8}px`
      );
      root.style.setProperty(
        "--border-radius",
        `${theme.spacing.border_radius_px || 4}px`
      );
    }
  }, [metadata]);

  return <>{children}</>;
}

export function useBrandMetadata(): BrandMetadata | null {
  const [metadata, setMetadata] = React.useState<BrandMetadata | null>(null);

  React.useEffect(() => {
    // In client components, we can get metadata from localStorage if it was set by server
    const stored = localStorage.getItem("brand_metadata");
    if (stored) {
      setMetadata(JSON.parse(stored));
    }
  }, []);

  return metadata;
}
