"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TenantSwitcher } from "@/components/tenant-switcher";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

export function Header() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-6 lg:h-[60px]">
      <div className="flex flex-1 items-center gap-4">
        <nav aria-label="Breadcrumb" className="hidden md:flex">
          <ol className="flex items-center gap-2 text-sm text-muted-foreground">
            <li>
              <Link href="/dashboard" className="hover:text-foreground">Dashboard</Link>
            </li>
            {segments.filter(s => s !== "dashboard").map((segment, index) => (
              <li key={segment} className="flex items-center gap-2">
                <span>/</span>
                <span className="capitalize text-foreground">{segment}</span>
              </li>
            ))}
          </ol>
        </nav>
        
        <div className="w-full flex-1 md:w-auto md:flex-none">
          <Button variant="outline" className="w-full md:w-64 justify-start text-muted-foreground bg-background" onClick={() => console.log("Open Command Palette")}>
            <Search className="mr-2 h-4 w-4" />
            Search...
            <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>
        </div>
      </div>
      
      <TenantSwitcher />
      
      <div className="flex items-center gap-4">
        <div className="h-8 w-8 rounded-full bg-slate-200" title="User Profile" />
      </div>
    </header>
  );
}
