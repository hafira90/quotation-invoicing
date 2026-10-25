"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select as BaseSelect } from "@/components/ui/select";
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

export function TemplateEditor({ onSave }: { onSave: (config: TemplateConfig) => void }) {
  const [config, setConfig] = useState<TemplateConfig>({
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
  });

  const handleSave = () => {
    onSave(config);
    toast("success", { description: "Template saved successfully" });
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-medium">Template Editor</h2>

      {/* Page Setup Section */}
      <div>
        <h3 className="font-medium mb-3">Page Setup</h3>
        <p className="text-slate-500 text-sm mb-4">
          Page setup controls coming soon
        </p>
      </div>

      {/* Theme Section */}
      <div>
        <h3 className="font-medium mb-3">Theme</h3>
        <p className="text-slate-500 text-sm mb-4">
          Theme customization coming soon
        </p>
      </div>

      {/* Document Elements Section */}
      <div>
        <h3 className="font-medium mb-3">Document Elements</h3>
        <p className="text-slate-500 text-sm mb-4">
          Document elements coming soon
        </p>
      </div>

      {/* Currency & Labels Section */}
      <div>
        <h3 className="font-medium mb-3">Currency & Labels</h3>
        <p className="text-slate-500 text-sm mb-4">
          Currency and labels coming soon
        </p>
      </div>

      {/* Buttons */}
      <div className="flex gap-4">
        <Button
          variant="secondary"
          onClick={() => setConfig({
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
          })}
        >
          Reset
        </Button><Button onClick={handleSave} variant="secondary">
          Save Template</Button>
      </div>
    </div>
  );
}