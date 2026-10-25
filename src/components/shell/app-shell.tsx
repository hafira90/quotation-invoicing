"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut, Menu, X } from "lucide-react";

import { Sidebar } from "./sidebar";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export interface ShellUser {
  name: string;
  email: string;
  roleKeys: string[];
  permissions: string[];
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrator",
  sales: "Sales",
  finance: "Finance",
  viewer: "Viewer",
};

export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
        <Sidebar permissions={user.permissions} />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
            <div className="flex justify-end p-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Sidebar permissions={user.permissions} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="min-w-0 flex-1" />

          <div className="hidden text-right sm:block">
            <p className="truncate text-sm font-medium text-slate-800">{user.name}</p>
            <p className="truncate text-xs text-slate-500">
              {user.roleKeys.map((r) => ROLE_LABELS[r] ?? r).join(", ")}
            </p>
          </div>

          <Link
            href="/account/password"
            className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            Profile
          </Link>

          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              Sign out
            </Button>
          </form>
        </header>

        <main className="flex-1 bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
