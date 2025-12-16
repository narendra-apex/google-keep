"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { formatPrice } from "@/lib/utils";
import { useCart } from "@/lib/cart-context";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/v1";

interface Variant {
  variant_id: string;
  sku: string;
  name: string;
  price_cents: number;
  attributes?: Record<string, string>;
  in_stock: boolean;
  inventory_count?: number;
}

interface ProductDetail {
  product_id: string;
  name: string;
  description: string;
  sku: string;
  status: string;
  price_cents: number;
  currency: string;
  category_id?: string;
  image_url?: string;
  gallery_images?: string[];
  variants?: Variant[];
  in_stock: boolean;
  rating?: number;
  review_count?: number;
}

interface Review {
  review_id: string;
  customer_id: string;
  rating: number;
  title?: string;
  comment: string;
  verified_purchase: boolean;
  helpful_count: number;
  created_at: string;
}

interface ReviewListResponse {
  data: Review[];
  average_rating: number;
  total_reviews: number;
}

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ brand: string; productId: string }>;
}) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<string | undefined>();
  const [imageIndex, setImageIndex] = useState(0);
  const [brand, setBrand] = useState<string>("");
  const [productId, setProductId] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { brand: b, productId: pid } = await params;
      setBrand(b);
      setProductId(pid);
    })();
  }, [params]);

  // Fetch product details
  const { data: product, isLoading: productLoading, error: productError } = useSWR<ProductDetail>(
    productId ? `${API_BASE_URL}/products/${productId}` : null,
    (url) => fetcher(url, { brandId: brand }),
    { revalidateOnFocus: false }
  );

  // Fetch reviews
  const { data: reviewsData } = useSWR<ReviewListResponse>(
    productId ? `${API_BASE_URL}/products/${productId}/reviews` : null,
    (url) => fetcher(url, { brandId: brand }),
    { revalidateOnFocus: false }
  );

  if (productError) {
    return (
      <div className="container py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-error mb-4">Product not found</h1>
        </div>
      </div>
    );
  }

  if (productLoading || !product) {
    return (
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gray-200 aspect-square rounded-lg animate-pulse" />
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 rounded w-3/4 animate-pulse" />
            <div className="h-6 bg-gray-200 rounded w-1/2 animate-pulse" />
            <div className="h-20 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const images = [product.image_url, ...(product.gallery_images || [])].filter(Boolean);
  const currentImage = images[imageIndex];

  const handleAddToCart = async () => {
    try {
      await addItem(product.product_id, quantity, selectedVariant);
      // Reset quantity
      setQuantity(1);
      alert("Added to cart!");
    } catch (err) {
      console.error("Failed to add to cart", err);
      alert("Failed to add to cart");
    }
  };

  return (
    <div className="container py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Image Gallery */}
        <div>
          <div className="relative bg-gray-100 rounded-lg overflow-hidden mb-4">
            {currentImage ? (
              <img
                src={currentImage}
                alt={product.name}
                className="w-full h-auto aspect-square object-cover"
              />
            ) : (
              <div className="w-full aspect-square flex items-center justify-center bg-gray-200">
                <span className="text-gray-400">No image</span>
              </div>
            )}

            {/* Navigation */}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setImageIndex(Math.max(0, imageIndex - 1))}
                  disabled={imageIndex === 0}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white p-2 rounded-full shadow disabled:opacity-50"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() =>
                    setImageIndex(Math.min(images.length - 1, imageIndex + 1))
                  }
                  disabled={imageIndex === images.length - 1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white p-2 rounded-full shadow disabled:opacity-50"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setImageIndex(idx)}
                  className={`relative rounded-lg overflow-hidden border-2 ${
                    idx === imageIndex ? "border-primary" : "border-gray-200"
                  }`}
                >
                  <img
                    src={img}
                    alt={`Thumbnail ${idx}`}
                    className="w-full aspect-square object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div>
          <h1 className="text-3xl font-bold text-text mb-2">{product.name}</h1>

          {/* Rating */}
          {product.rating && (
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={16}
                    className={
                      i < Math.floor(product.rating!)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }
                  />
                ))}
              </div>
              <span className="text-sm text-gray-600">
                {product.rating} ({product.review_count || 0} reviews)
              </span>
            </div>
          )}

          {/* Price */}
          <div className="mb-6">
            <p className="text-3xl font-bold text-primary">
              {formatPrice(product.price_cents, product.currency)}
            </p>
            {!product.in_stock && (
              <p className="text-error font-semibold mt-2">Out of Stock</p>
            )}
          </div>

          {/* Description */}
          <p className="text-gray-600 mb-8">{product.description}</p>

          {/* Variants */}
          {product.variants && product.variants.length > 0 && (
            <div className="mb-8">
              <h3 className="font-semibold text-text mb-3">Select Variant</h3>
              <div className="grid grid-cols-2 gap-3">
                {product.variants.map((variant) => (
                  <button
                    key={variant.variant_id}
                    onClick={() => setSelectedVariant(variant.variant_id)}
                    disabled={!variant.in_stock}
                    className={`p-3 border-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedVariant === variant.variant_id
                        ? "border-primary bg-primary bg-opacity-10"
                        : "border-gray-200"
                    }`}
                  >
                    <div>{variant.name}</div>
                    <div className="text-xs mt-1">
                      {formatPrice(variant.price_cents, product.currency)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity and Add to Cart */}
          <div className="space-y-4">
            <div>
              <label className="block font-semibold text-text mb-2">Quantity</label>
              <div className="flex items-center border border-gray-300 rounded-lg w-fit">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-4 py-2 text-text hover:bg-gray-100"
                >
                  −
                </button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 text-center border-none"
                />
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-4 py-2 text-text hover:bg-gray-100"
                >
                  +
                </button>
              </div>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={!product.in_stock}
              className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add to Cart
            </button>
          </div>

          {/* SKU */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-600">SKU: {product.sku}</p>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      {reviewsData && reviewsData.total_reviews > 0 && (
        <div className="mt-16 pt-8 border-t border-gray-200">
          <h2 className="text-2xl font-bold text-text mb-6">Customer Reviews</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Summary */}
            <div>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl font-bold">{reviewsData.average_rating}</span>
                <span className="text-gray-600">out of 5</span>
              </div>
              <div className="flex items-center gap-2 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={20}
                    className={
                      i < Math.floor(reviewsData.average_rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }
                  />
                ))}
              </div>
              <p className="text-gray-600">{reviewsData.total_reviews} reviews</p>
            </div>

            {/* Reviews List */}
            <div className="space-y-4">
              {reviewsData.data.slice(0, 3).map((review) => (
                <div key={review.review_id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={14}
                          className={
                            i < review.rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300"
                          }
                        />
                      ))}
                    </div>
                    {review.verified_purchase && (
                      <span className="text-xs bg-success text-white px-2 py-1 rounded">
                        Verified
                      </span>
                    )}
                  </div>
                  {review.title && (
                    <h4 className="font-semibold text-text mb-1">{review.title}</h4>
                  )}
                  <p className="text-sm text-gray-600 mb-2">{review.comment}</p>
                  <p className="text-xs text-gray-500">
                    {review.helpful_count} people found this helpful
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
