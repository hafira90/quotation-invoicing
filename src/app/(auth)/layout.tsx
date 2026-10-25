export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white">
            QI
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            Quotation & Invoicing
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Secure access for authorised staff only
          </p>
        </div>
        {children}
        <p className="mt-6 text-center text-xs text-slate-400">
          All activity is recorded in the audit log.
        </p>
      </div>
    </div>
  );
}
