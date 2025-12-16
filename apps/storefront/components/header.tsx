"use client";

import Link from "next/link";
import { useMiniCart } from "@/lib/cart-context";
import { BrandMetadata } from "@/lib/server-actions/brands";
import { ShoppingCart, Menu } from "lucide-react";
import { useState } from "react";

interface HeaderProps {
  brand: BrandMetadata;
}

export default function Header({ brand }: HeaderProps) {
  const { itemCount, total } = useMiniCart();
  const [menuOpen, setMenuOpen] = useState(false);

  const logo = brand.settings.theme?.branding?.logo_url;
  const logoPosition = brand.settings.theme?.storefront?.logo_position || "top_left";

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-gray-200 shadow-sm">
      <div className="container">
        <div className="flex items-center justify-between h-16 px-4">
          {/* Logo */}
          <div className="flex-1">
            <Link
              href={`/${brand.brand_id}`}
              className="flex items-center space-x-2"
            >
              {logo && (
                <img
                  src={logo}
                  alt={brand.settings.theme?.branding?.logo_alt_text || brand.name}
                  className="h-8"
                />
              )}
              <span className="font-bold text-lg text-primary">{brand.name}</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-8 flex-1 justify-center">
            <Link href={`/${brand.brand_id}`} className="text-text hover:text-primary">
              Products
            </Link>
            <Link href={`/${brand.brand_id}/cart`} className="text-text hover:text-primary">
              Cart
            </Link>
            <Link
              href={`/${brand.brand_id}/about`}
              className="text-text hover:text-primary"
            >
              About
            </Link>
          </nav>

          {/* Mini Cart */}
          <div className="flex items-center space-x-4 flex-1 justify-end">
            <Link
              href={`/${brand.brand_id}/cart`}
              className="relative p-2 text-text hover:text-primary"
            >
              <ShoppingCart size={24} />
              {itemCount > 0 && (
                <span className="absolute top-0 right-0 bg-error text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>

            {/* Mobile menu button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 text-text hover:text-primary"
            >
              <Menu size={24} />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <nav className="md:hidden border-t border-gray-200 py-4 px-4 space-y-2">
            <Link
              href={`/${brand.brand_id}`}
              className="block text-text hover:text-primary py-2"
            >
              Products
            </Link>
            <Link
              href={`/${brand.brand_id}/cart`}
              className="block text-text hover:text-primary py-2"
            >
              Cart
            </Link>
            <Link
              href={`/${brand.brand_id}/about`}
              className="block text-text hover:text-primary py-2"
            >
              About
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
