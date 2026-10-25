"use client";

import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function DocumentPreview({ documentType }: { documentType: "quotation" | "invoice" | "receipt" | "credit_note" }) {
  const pathname = useParams();

  return (
    <div className="p-6">
      <h2 className="text-2xl font-medium mb-4">Preview</h2>

      <div className="border rounded-lg p-6 bg-white min-h-[500px]">
        <p className="text-slate-400 text-center py-8">
          {documentType} preview will render here with the selected template configuration.
        </p>
        <p className="text-slate-500 text-center">
          Document type: {documentType}
        </p>
      </div>
    </div>
  );
}