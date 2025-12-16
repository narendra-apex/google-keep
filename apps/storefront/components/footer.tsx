"use client";

import Link from "next/link";
import { BrandMetadata } from "@/lib/server-actions/brands";

interface FooterProps {
  brand: BrandMetadata;
}

export default function Footer({ brand }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white mt-16">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div>
            <h3 className="font-bold text-lg mb-4">{brand.name}</h3>
            <p className="text-gray-300 text-sm">{brand.legal_name}</p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-bold mb-4">Shop</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={`/${brand.brand_id}`} className="text-gray-300 hover:text-white">
                  Products
                </Link>
              </li>
              <li>
                <Link
                  href={`/${brand.brand_id}/cart`}
                  className="text-gray-300 hover:text-white"
                >
                  Cart
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-bold mb-4">Support</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="text-gray-300 hover:text-white">
                  Contact Us
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-300 hover:text-white">
                  FAQ
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-300 hover:text-white">
                  Returns
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-bold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="text-gray-300 hover:text-white">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-300 hover:text-white">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-gray-700 mt-8 pt-8 text-sm text-gray-300 flex items-center justify-between">
          <p>&copy; {currentYear} {brand.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
