import type { Metadata } from "next";
import { CartProvider } from "@/lib/cart-context";
import StoreLayoutContent from "./store-layout-content";

export async function generateMetadata(): Promise<Metadata> {
  // Default metadata - will be overridden by child pages
  return {
    title: "Store",
    description: "Multi-brand commerce storefront",
  };
}

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <StoreLayoutContent>{children}</StoreLayoutContent>
    </CartProvider>
  );
}
