"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navConfig } from "@/config/nav";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="hidden border-r bg-muted/40 md:block w-[220px] lg:w-[280px] h-full">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="">Unified OS</span>
          </Link>
        </div>
        <div className="flex-1">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            {navConfig.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                    pathname === item.href || pathname.startsWith(item.href + "/") 
                      ? "bg-muted text-primary" 
                      : "text-muted-foreground"
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {item.title}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
