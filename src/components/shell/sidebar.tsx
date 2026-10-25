"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { visibleSections } from "./nav-items";
import { cn } from "@/lib/utils";

export function Sidebar({
  permissions,
  onNavigate,
}: {
  permissions: string[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const sections = visibleSections(permissions);

  return (
    <nav className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-5">
      <div className="flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-semibold text-white">
          QI
        </div>
        <span className="text-sm font-semibold tracking-tight text-slate-900">
          Quotation & Invoicing
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-6">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">
              {section.label}
            </p>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                        active
                          ? "bg-slate-900 font-medium text-white"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-slate-400")} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
