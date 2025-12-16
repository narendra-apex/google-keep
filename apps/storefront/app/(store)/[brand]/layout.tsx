import { cookies } from "next/headers";
import { getBrandMetadata, getDefaultBrandMetadata } from "@/lib/server-actions/brands";

export default async function BrandLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ brand: string }>;
}) {
  const { brand: brandId } = await params;

  // Fetch brand metadata on server
  let brandMetadata = await getBrandMetadata(brandId);

  // Fallback to default if fetch fails
  if (!brandMetadata) {
    brandMetadata = await getDefaultBrandMetadata(brandId);
  }

  // Store metadata in cookie for client-side access
  const cookieStore = await cookies();
  cookieStore.set("brand_metadata", JSON.stringify(brandMetadata));
  cookieStore.set("brand_id", brandId);

  return children;
}
