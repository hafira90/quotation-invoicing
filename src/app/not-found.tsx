import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <p className="text-sm font-medium text-slate-500">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
        Page not found
      </h1>
      <p className="mt-2 max-w-md text-sm text-slate-600">
        The page you requested does not exist, or you do not have access to it.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
