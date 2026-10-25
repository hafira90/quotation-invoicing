"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select as BaseSelect } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TemplateConfig {
  pageSize: "A4" | "Letter" | "A5";
  orientation: "portrait" | "landscape";
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  theme: {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    textColor: string;
  };
  showHeader: boolean;
  showFooter: boolean;
  showPageNumbers: boolean;
  currencySymbol: string;
  labels: Record<string, string>;
}

export function DocumentDesigner() {
  const initialConfig: TemplateConfig = {
    pageSize: "A4",
    orientation: "portrait",
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
    theme: {
      primaryColor: "#1e40af",
      secondaryColor: "#3b82f6",
      backgroundColor: "white",
      textColor: "#1e293b",
    },
    showHeader: true,
    showFooter: true,
    showPageNumbers: true,
    currencySymbol: "RM",
    labels: {
      subtotal: "Subtotal",
      discount: "Discount",
      tax: "Tax",
      grandTotal: "Grand Total",
    },
  };

  const [config, setConfig] = useState<TemplateConfig>(initialConfig);

  const handleSave = () => {
    // TODO: Save template to database
    toast("success", { description: "Template saved successfully" });
  };

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-6">Document Designer</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Document Type Selector */}
        <div className="space-y-4">
          <h2 className="text-xl font-medium mb-4">Document Types</h2>
          <div className="space-y-2">
            <Button
              variant="outline"
              onClick={() =>
                setConfig((c) => ({ ...c, pageSize: "A4", orientation: "portrait" }))
              }
              className="w-full py-3 px-4 border rounded-md hover:bg-slate-50"
            >
              Quotation
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                setConfig((c) => ({ ...c, pageSize: "A4", orientation: "portrait" }))
              }
              className="w-full py-3 px-4 border rounded-md hover:bg-slate-50"
            >
              Invoice
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                setConfig((c) => ({ ...c, pageSize: "A4", orientation: "portrait" }))
              }
              className="w-full py-3 px-4 border rounded-md hover:bg-slate-50"
            >
              Receipt
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                setConfig((c) => ({ ...c, pageSize: "A4", orientation: "portrait" }))
              }
              className="w-full py-3 px-4 border rounded-md hover:bg-slate-50"
            >
              Credit Note
            </Button>
          </div>
        </div>

        {/* Middle: Template Editor */}
        <div className="space-y-4">
          <h2 className="text-xl font-medium mb-4">Template Editor</h2>

          <div>
            <h3 className="font-medium mb-3">Page Setup</h3>
            <p className="text-slate-500 text-sm mb-4">
              Page setup controls coming soon
            </p>
          </div>

          <div>
            <h3 className="font-medium mb-3">Theme</h3>
            <p className="text-slate-500 text-sm mb-4">
              Theme customization coming soon
            </p>
          </div>

          <div>
            <h3 className="font-medium mb-3">Document Elements</h3>
            <p className="text-slate-500 text-sm mb-4">
              Document elements coming soon
            </p>
          </div>

          <div>
            <h3 className="font-medium mb-3">Currency & Labels</h3>
            <p className="text-slate-500 text-sm mb-4">
              Currency and labels coming soon
            </p>
          </div>

          <div className="flex gap-4">
            <Button
              variant="secondary"
              onClick={() => setConfig(initialConfig)}
            >
              Reset
            </Button>
            <Button onClick={handleSave} variant="secondary">
              Save Template
            </Button>
          </div>
        </div>

        {/* Right: Live Preview */}
        <div className="space-y-4">
          <h2 className="text-xl font-medium">Live Preview</h2>

          <div className="border rounded-lg p-6 bg-slate-50 min-h-[400px]">
            <p className="text-slate-400 text-center py-8">
              Preview of {config.pageSize || "A4"} with current template settings
            </p>
            <p className="text-slate-500 text-center">
              Page: {config.pageSize || "A4"} | {config.orientation || "portrait"} |
              Margins: {config.margins?.top || 20}px
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}