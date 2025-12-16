"use client";

import { useEffect, useState, useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import ProductCard, { Product } from "@/components/product-card";
import { useCart } from "@/lib/cart-context";
import { ChevronDown } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/v1";

interface ProductListResponse {
  data: Product[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    has_more: boolean;
  };
}

interface FilterParams {
  limit: number;
  offset: number;
  status?: string;
  category_id?: string;
}

export default function ProductListingPage({
  params,
}: {
  params: Promise<{ brand: string }>;
}) {
  const { addItem } = useCart();
  const [filters, setFilters] = useState<FilterParams>({
    limit: 20,
    offset: 0,
  });
  const [sortBy, setSortBy] = useState<string>("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [brand, setBrand] = useState<string>("");

  // Unwrap params
  useEffect(() => {
    (async () => {
      const { brand: b } = await params;
      setBrand(b);
    })();
  }, [params]);

  // Fetch products with SWR
  const queryString = new URLSearchParams({
    limit: String(filters.limit),
    offset: String(filters.offset),
    ...(filters.status && { status: filters.status }),
    ...(filters.category_id && { category_id: filters.category_id }),
  }).toString();

  const { data, error, isLoading } = useSWR<ProductListResponse>(
    brand ? `${API_BASE_URL}/products?${queryString}` : null,
    (url) => fetcher(url, { brandId: brand }),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  // Sort products client-side
  const sortedProducts = useMemo(() => {
    if (!data?.data) return [];

    const sorted = [...data.data];
    switch (sortBy) {
      case "price_low":
        sorted.sort((a, b) => a.price_cents - b.price_cents);
        break;
      case "price_high":
        sorted.sort((a, b) => b.price_cents - a.price_cents);
        break;
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "newest":
      default:
        // Assume API returns newest first
        break;
    }
    return sorted;
  }, [data?.data, sortBy]);

  const handleAddToCart = async (productId: string) => {
    try {
      await addItem(productId, 1);
      // Show success message (could use toast)
      console.log("Added to cart");
    } catch (err) {
      console.error("Failed to add to cart", err);
    }
  };

  const handlePreviousPage = () => {
    setFilters((prev) => ({
      ...prev,
      offset: Math.max(0, prev.offset - prev.limit),
    }));
  };

  const handleNextPage = () => {
    if (data?.pagination.has_more) {
      setFilters((prev) => ({
        ...prev,
        offset: prev.offset + prev.limit,
      }));
    }
  };

  const handleFilterChange = (filterKey: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      offset: 0, // Reset to first page
      [filterKey]: value || undefined,
    }));
  };

  if (error) {
    return (
      <div className="container py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-error mb-4">Error loading products</h1>
          <p className="text-gray-600">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!brand) {
    return <div className="container py-12">Loading...</div>;
  }

  return (
    <div className="container py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text mb-2">Products</h1>
        <p className="text-gray-600">
          {data?.pagination.total || 0} products available
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Sidebar Filters */}
        <aside className="md:col-span-1">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="md:hidden w-full mb-4 p-3 bg-primary text-white rounded-lg font-medium flex items-center justify-between"
          >
            Filters
            <ChevronDown
              size={20}
              className={`transition-transform ${showFilters ? "rotate-180" : ""}`}
            />
          </button>

          <div className={`space-y-6 ${showFilters ? "block" : "hidden md:block"}`}>
            {/* Status Filter */}
            <div>
              <label className="block font-semibold text-text mb-3">Status</label>
              <select
                value={filters.status || ""}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block font-semibold text-text mb-3">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="newest">Newest</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
                <option value="name">Name: A to Z</option>
              </select>
            </div>
          </div>
        </aside>

        {/* Products Grid */}
        <main className="md:col-span-3">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-gray-200 rounded-lg aspect-square animate-pulse" />
              ))}
            </div>
          ) : sortedProducts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No products found</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {sortedProducts.map((product) => (
                  <ProductCard
                    key={product.product_id}
                    product={product}
                    brandId={brand}
                    onAddToCart={handleAddToCart}
                  />
                ))}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <button
                  onClick={handlePreviousPage}
                  disabled={filters.offset === 0}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                <span className="text-sm text-gray-600">
                  Page {Math.floor(filters.offset / filters.limit) + 1} of{" "}
                  {Math.ceil((data?.pagination.total || 0) / filters.limit)}
                </span>

                <button
                  onClick={handleNextPage}
                  disabled={!data?.pagination.has_more}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
