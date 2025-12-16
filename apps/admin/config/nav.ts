import { 
  LayoutDashboard, 
  Store, 
  Users, 
  GitBranch, 
  Flag, 
  Settings, 
  ShoppingCart, 
  Package 
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon?: any;
};

export const navConfig: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Brands",
    href: "/brands",
    icon: Store,
  },
  {
    title: "Users",
    href: "/users",
    icon: Users,
  },
  {
    title: "Workflows",
    href: "/workflows",
    icon: GitBranch,
  },
  {
    title: "Feature Flags",
    href: "/feature-flags",
    icon: Flag,
  },
  {
    title: "Procurement",
    href: "/procurement",
    icon: ShoppingCart,
  },
  {
    title: "Catalog",
    href: "/catalog",
    icon: Package,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];
