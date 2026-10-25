import Image from "next/image";

export default function Page404() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <Image
        src="/window.svg"
        alt="Quotation & Invoicing"
        width={100}
        height={100}
        className="mb-6"
      />

      <h1 className="text-5xl font-bold text-slate-900 mb-4">
        Page Not Found
      </h1>

      <p className="text-slate-600 text-lg mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>

      <div>
        <a href="/" className="btn btn-primary">
          Go to Dashboard
        </a>
        <a href="/quotations" className="ml-4 text-slate-500 hover:text-slate-700">
          View Quotations
        </a>
      </div>
    </div>
  );
}