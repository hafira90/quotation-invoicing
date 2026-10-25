"use client";

import Link from "next/link";

/**
 * Error boundary for authenticated routes (client component by contract).
 * Renders a clear 403 panel when the server rejected a missing permission,
 * and a generic message otherwise so stack traces never reach the browser.
 *
 * Detected by `error.name` rather than an instanceof check so this file does
 * not import the server-only session module.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isForbidden = error.name === "ForbiddenError";

  if (isForbidden) {
    return (
      <div className="mx-auto w-full max-w-lg rounded-xl border border-amber-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-amber-700">403 · Forbidden</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">
          You do not have permission
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Your role does not include access to this area. Ask a Super Admin to
          grant it if you need it.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  console.error("[app] unhandled error", { message: error.message, digest: error.digest });

  return (
    <div className="mx-auto w-full max-w-lg rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm">
      <p className="text-sm font-medium text-red-700">Something went wrong</p>
      <h1 className="mt-2 text-xl font-semibold text-slate-900">
        We could not complete that request
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        The problem has been logged. You can try again.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
