import {
  BarChart3,
  FileMinus2,
  FileText,
  LayoutDashboard,
  Package,
  Palette,
  Receipt,
  ScrollText,
  Settings,
  Users,
  UserCog,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { PERMISSIONS, type PermissionCode } from "@/lib/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: PermissionCode;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/**
 * Sidebar structure. Every entry carries the permission the server enforces
 * too — a user without it never sees the link, and is rejected server-side
 * if they type the URL.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/quotations", label: "Quotations", icon: FileText, permission: PERMISSIONS.QUOTATION_VIEW },
      { href: "/invoices", label: "Invoices", icon: Receipt, permission: PERMISSIONS.INVOICE_VIEW },
      { href: "/customers", label: "Customers", icon: Users, permission: PERMISSIONS.CUSTOMER_VIEW },
      { href: "/products", label: "Products & Services", icon: Package, permission: PERMISSIONS.PRODUCT_VIEW },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/payments", label: "Payments & Receipts", icon: Wallet, permission: PERMISSIONS.PAYMENT_VIEW },
      { href: "/credit-notes", label: "Credit Notes", icon: FileMinus2, permission: PERMISSIONS.CREDIT_NOTE_VIEW },
      { href: "/reports", label: "Reports", icon: BarChart3, permission: PERMISSIONS.REPORT_VIEW },
    ],
  },
  {
    label: "Configuration",
    items: [
      { href: "/designer", label: "Document Designer", icon: Palette, permission: PERMISSIONS.TEMPLATE_VIEW },
      { href: "/settings", label: "Settings", icon: Settings, permission: PERMISSIONS.SETTINGS_VIEW },
      { href: "/users", label: "User Management", icon: UserCog, permission: PERMISSIONS.USER_VIEW },
      { href: "/audit-logs", label: "Audit Logs", icon: ScrollText, permission: PERMISSIONS.AUDIT_VIEW },
    ],
  },
];

export function visibleSections(permissions: string[]): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => permissions.includes(item.permission)),
  })).filter((section) => section.items.length > 0);
}
