import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "./login-form";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

/** Session read + searchParams: render per request, no static shell. */
export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; reset?: string }>;
}) {
  const user = await getSessionUser();
  if (user && !user.mustChangePassword) redirect("/dashboard");

  const { next, error, reset } = await searchParams;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900">
        Sign in
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Use the account your administrator created for you.
      </p>

      {reset ? (
        <div
          role="status"
          className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          Password updated. Sign in with your new password.
        </div>
      ) : null}

      {error === "account_disabled" ? (
        <div
          role="alert"
          className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          This account has been disabled. Contact an administrator.
        </div>
      ) : null}

      <div className="mt-6">
        <LoginForm next={next} />
      </div>

      <div className="mt-5 text-center text-sm text-slate-500">
        <Link
          href="/forgot-password"
          className="font-medium text-slate-700 underline-offset-4 hover:underline"
        >
          Forgot your password?
        </Link>
      </div>
    </div>
  );
}
