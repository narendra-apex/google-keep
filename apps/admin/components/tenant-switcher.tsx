"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Store } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function TenantSwitcher({
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedBrand, setSelectedBrand] = React.useState<string>("");
  const [brands, setBrands] = React.useState<{ id: string; name: string }[]>([]);

  React.useEffect(() => {
    // Fetch brands
    async function fetchBrands() {
      try {
        const res = await fetch("/api/admin/tenants");
        if (res.ok) {
          const json = await res.json();
          // Adjust based on API response structure
          const data = json.data || json; 
          setBrands(data);
          
          // Load persisted selection
          const persisted = localStorage.getItem("selected_brand_id");
          if (persisted && data.find((b: any) => b.id === persisted)) {
            setSelectedBrand(persisted);
          } else if (data.length > 0) {
            setSelectedBrand(data[0].id);
            localStorage.setItem("selected_brand_id", data[0].id);
            document.cookie = `brand_id=${data[0].id}; path=/`;
          }
        }
      } catch (e) {
        console.error("Failed to fetch brands", e);
      }
    }
    fetchBrands();
  }, []);

  const handleSelect = (brandId: string) => {
    setSelectedBrand(brandId);
    setIsOpen(false);
    localStorage.setItem("selected_brand_id", brandId);
    document.cookie = `brand_id=${brandId}; path=/`;
    // Optionally trigger a refresh or context update
    window.location.reload(); 
  };

  const selectedBrandName = brands.find((b) => b.id === selectedBrand)?.name || "Select Brand";

  return (
    <div className={cn("relative", className)}>
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={isOpen}
        aria-label="Select a brand"
        className="w-[200px] justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Store className="mr-2 h-4 w-4" />
        {selectedBrandName}
        <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {isOpen && (
        <div className="absolute top-full z-50 mt-1 w-[200px] rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95">
          <div className="p-1">
             {brands.map((brand) => (
                <div
                  key={brand.id}
                  className={cn(
                    "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                    selectedBrand === brand.id && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => handleSelect(brand.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedBrand === brand.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {brand.name}
                </div>
              ))}
              {brands.length === 0 && <div className="p-2 text-sm text-muted-foreground">No brands found.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
