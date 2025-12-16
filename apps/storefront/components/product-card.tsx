"use client";

import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/lib/utils";
import { ShoppingCart } from "lucide-react";

export interface Product {
  product_id: string;
  name: string;
  description?: string;
  sku?: string;
  status: string;
  price_cents: number;
  currency?: string;
  image_url?: string;
  category_id?: string;
  in_stock?: boolean;
  rating?: number;
  review_count?: number;
}

interface ProductCardProps {
  product: Product;
  brandId: string;
  onAddToCart?: (productId: string) => void;
}

export default function ProductCard({
  product,
  brandId,
  onAddToCart,
}: ProductCardProps) {
  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onAddToCart) {
      onAddToCart(product.product_id);
    }
  };

  return (
    <Link href={`/${brandId}/products/${product.product_id}`}>
      <div className="group bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col">
        {/* Image */}
        <div className="relative bg-gray-100 aspect-square overflow-hidden">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-200">
              <span className="text-gray-400">No image</span>
            </div>
          )}

          {/* Stock badge */}
          {!product.in_stock && (
            <div className="absolute top-2 right-2 bg-gray-800 text-white px-2 py-1 text-xs rounded">
              Out of Stock
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col flex-1">
          <h3 className="font-semibold text-text line-clamp-2 mb-2">
            {product.name}
          </h3>

          {product.description && (
            <p className="text-sm text-gray-600 line-clamp-2 mb-4">
              {product.description}
            </p>
          )}

          {/* Rating */}
          {product.rating && (
            <div className="flex items-center gap-1 mb-4">
              <span className="text-yellow-500 text-sm">★</span>
              <span className="text-sm text-gray-600">
                {product.rating} ({product.review_count || 0} reviews)
              </span>
            </div>
          )}

          {/* Price and Button */}
          <div className="mt-auto space-y-3">
            <p className="text-lg font-bold text-primary">
              {formatPrice(product.price_cents, product.currency || "USD")}
            </p>

            <button
              onClick={handleAddToCart}
              disabled={!product.in_stock}
              className="w-full bg-primary text-white py-2 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <ShoppingCart size={18} />
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
