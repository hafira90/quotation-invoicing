import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900">
        Reset your password
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        We will email you a single-use link that expires in 30 minutes.
      </p>

      <div className="mt-6">
        <ForgotPasswordForm />
      </div>

      <div className="mt-5 text-center text-sm">
        <Link
          href="/login"
          className="font-medium text-slate-600 underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
