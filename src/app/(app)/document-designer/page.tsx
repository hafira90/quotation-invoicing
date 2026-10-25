import type { Metadata } from "next";

export const metadata: Metadata = { title: "Document Designer" };

export default function DocumentDesignerPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Document Designer</h1>
      <p className="text-slate-500 mb-6">
        Build and customize document templates for quotations, invoices, receipts, and credit notes.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <h2 className="text-xl font-medium">Document Types</h2>
          <div className="space-y-2">
            <button className="w-full py-2 px-4 border rounded-md hover:bg-slate-100">
              Quotation
            </button>
            <button className="w-full py-2 px-4 border rounded-md hover:bg-slate-100">
              Invoice
            </button>
            <button className="w-full py-2 px-4 border rounded-md hover:bg-slate-100">
              Receipt
            </button>
            <button className="w-full py-2 px-4 border rounded-md hover:bg-slate-100">
              Credit Note
            </button>
          </div>
        </div>
        <div className="space-y-4">
          <h2 className="text-xl font-medium">Template Editor</h2>
          <p className="text-slate-500 small">Visual editor coming soon</p>
          <div className="border rounded-md p-4 bg-slate-50 min-h-[400px]">
            <p className="text-slate-400 text-center py-8">Template editor UI</p>
          </div>
        </div>
        <div className="space-y-4">
          <h2 className="text-xl font-medium">Preview</h2>
          <p className="text-slate-500 small">Live preview</p>
          <div className="border rounded-md p-4 bg-slate-50 min-h-[400px]">
            <p className="text-slate-400 text-center py-8">Document preview</p>
          </div>
        </div>
      </div>
    </div>
  );
}