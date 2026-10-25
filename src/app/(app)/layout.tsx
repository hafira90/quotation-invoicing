import { redirect } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/session";

/**
 * Every route under (app) is behind this layout: no session means no page.
 * Individual pages then call requirePermission() for fine-grained checks, and
 * Server Actions / Route Handlers do the same independently.
 *
 * The layout reads the session cookie, so the segment renders per request
 * instead of being prerendered into a static shell.
 */
export const instant = false;
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  if (user.mustChangePassword) {
    redirect("/account/password?required=1");
  }

  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        roleKeys: user.roleKeys,
        permissions: user.permissions,
      }}
    >
      {children}
    </AppShell>
  );
}
