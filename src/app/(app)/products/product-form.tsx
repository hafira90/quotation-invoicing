"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { saveProductAction, type ProductActionState } from "@/lib/actions/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const INITIAL: ProductActionState = { ok: true };

const KINDS = [
  ["product", "Product"],
  ["service", "Service"],
  ["labour", "Labour"],
  ["consultancy", "Consultancy"],
  ["subscription", "Subscription"],
  ["delivery", "Delivery"],
  ["misc", "Miscellaneous"],
] as const;

const NONE = "__none";

type Product = {
  id?: string;
  kind: string;
  sku: string | null;
  name: string;
  description: string | null;
  categoryId: string | null;
  unit: string;
  unitPrice: string;
  costPrice: string | null;
  discountType: "none" | "percent" | "amount";
  discountValue: string;
  taxRateId: string | null;
  notes: string | null;
};

export function ProductForm({
  product,
  options,
  showCost = true,
}: {
  product?: Product;
  options: {
    rates: { id: string; code: string; name: string; rate: string }[];
    categories: { id: string; name: string }[];
  };
  showCost?: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveProductAction, INITIAL);
  const router = useRouter();

  /* Base UI Select renders the raw value in the trigger unless it is given a
     value → label map; these keep human labels visible. */
  const kindItems = Object.fromEntries(KINDS);
  const categoryItems: Record<string, string> = { [NONE]: "No category" };
  for (const c of options.categories) categoryItems[c.id] = c.name;
  const taxItems: Record<string, string> = { [NONE]: "No tax" };
  for (const r of options.rates) taxItems[r.id] = `${r.name} (${r.rate}%)`;
  const discountItems: Record<string, string> = {
    none: "No discount",
    percent: "Percent (%)",
    amount: "Fixed amount",
  };

  useEffect(() => {
    if (state.ok && state.saved) {
      toast.success(product?.id ? "Item updated" : "Item created");
      router.push("/products");
      router.refresh();
    }
  }, [state, router, product?.id]);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {product?.id ? <input type="hidden" name="id" value={product.id} /> : null}
      {state.duplicateWarning ? (
        <div
          role="alert"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          <p>{state.duplicateWarning}</p>
          <input type="hidden" name="force" value="true" />
        </div>
      ) : null}

      {!state.ok && state.fieldErrors?.length ? (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <ul className="list-disc pl-4">
            {state.fieldErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!state.ok && state.error ? (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="kind">Type</Label>
          <Select name="kind" defaultValue={product?.kind ?? "product"} items={kindItems}>
            <SelectTrigger id="kind">
              <SelectValue placeholder="Product" />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">
            Name <span className="text-red-600">*</span>
          </Label>
          <Input id="name" name="name" defaultValue={product?.name ?? ""} required maxLength={200} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sku">SKU / service code</Label>
          <Input id="sku" name="sku" defaultValue={product?.sku ?? ""} maxLength={60} placeholder="e.g. SVC-001" />
          <p className="text-xs text-slate-500">Unique per company when set.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="unit">
            Unit of measure <span className="text-red-600">*</span>
          </Label>
          <Input id="unit" name="unit" defaultValue={product?.unit ?? "unit"} required maxLength={30} placeholder="unit, hour, lot…" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="categoryId">Category</Label>
          <Select name="categoryId" defaultValue={product?.categoryId ?? NONE} items={categoryItems}>
            <SelectTrigger id="categoryId">
              <SelectValue placeholder="No category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">No category</SelectItem>
              {options.categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="taxRateId">Tax rate</Label>
          <Select name="taxRateId" defaultValue={product?.taxRateId ?? NONE} items={taxItems}>
            <SelectTrigger id="taxRateId">
              <SelectValue placeholder="No tax" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">No tax</SelectItem>
              {options.rates.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name} ({r.rate}%)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500">
            Tax rates are configured in Settings — SST is never assumed.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="unitPrice">
            Default unit price <span className="text-red-600">*</span>
          </Label>
          <Input
            id="unitPrice"
            name="unitPrice"
            inputMode="decimal"
            defaultValue={product?.unitPrice ?? ""}
            required
            placeholder="0.00"
          />
        </div>

        {showCost ? (
          <div className="space-y-2">
            <Label htmlFor="costPrice">Cost price (internal)</Label>
            <Input
              id="costPrice"
              name="costPrice"
              inputMode="decimal"
              defaultValue={product?.costPrice ?? ""}
              placeholder="0.00"
            />
            <p className="text-xs text-slate-500">Visible only to users with cost permission.</p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="discountType">Default discount</Label>
          <Select name="discountType" defaultValue={product?.discountType ?? "none"} items={discountItems}>
            <SelectTrigger id="discountType">
              <SelectValue placeholder="No discount" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No discount</SelectItem>
              <SelectItem value="percent">Percent (%)</SelectItem>
              <SelectItem value="amount">Fixed amount</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="discountValue">Discount value</Label>
          <Input
            id="discountValue"
            name="discountValue"
            inputMode="decimal"
            defaultValue={product?.discountValue ?? ""}
            placeholder="0"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={product?.description ?? ""}
          maxLength={5000}
        />
        <p className="text-xs text-slate-500">
          Used as the default line description on quotations and invoices.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Internal notes</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={product?.notes ?? ""} maxLength={5000} />
        <p className="text-xs text-slate-500">Never shown on documents.</p>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {product?.id ? "Save changes" : "Create item"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
