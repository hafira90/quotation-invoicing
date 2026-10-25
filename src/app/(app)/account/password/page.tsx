import type { Metadata } from "next";

import { ChangePasswordForm } from "./change-password-form";
import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Password" };

/** Reads the session and searchParams. */
export const instant = false;

export default async function PasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { required } = await searchParams;
  const mustChange = user.mustChangePassword || required === "1";

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          {mustChange ? "Set your password" : "Change password"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {mustChange
            ? "Your account was created with a temporary password. Choose your own before continuing."
            : "You will need your current password. Signing out everywhere else is automatic."}
        </p>

        <div className="mt-6">
          <ChangePasswordForm required={Boolean(mustChange)} />
        </div>
      </div>
    </div>
  );
}
