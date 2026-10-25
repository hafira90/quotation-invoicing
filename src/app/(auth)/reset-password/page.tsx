import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

/** Reads the single-use token from searchParams. */
export const instant = false;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900">
        Choose a new password
      </h2>

      {!token ? (
        <div className="mt-4 space-y-4">
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            This reset link is missing its token. Request a new one.
          </div>
          <Link
            href="/forgot-password"
            className="block text-center text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
          >
            Request a new link
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-slate-500">
            The link is single-use and expires 30 minutes after it was sent.
          </p>
          <div className="mt-6">
            <ResetPasswordForm token={token} />
          </div>
        </>
      )}
    </div>
  );
}
