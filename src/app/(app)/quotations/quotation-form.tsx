"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";

import { saveQuotationAction, type QuotationActionState } from "@/lib/actions/quotations";
import { calculateDocument, type DiscountType } from "@/lib/calc";
import { formatMoney } from "@/lib/format";
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

const INITIAL: QuotationActionState = { ok: true };
const NONE = "__none";

type Options = {
  customers: {
    id: string;
    name: string;
    defaultCurrency: string | null;
    paymentTermsDays: number | null;
    taxExempt: boolean | null;
  }[];
  products: {
    id: string;
    name: string;
    sku: string | null;
    unit: string;
    unitPrice: string;
    discountType: DiscountType;
    discountValue: string;
    taxRateId: string | null;
    description: string | null;
  }[];
  rates: { id: string; name: string; rate: string; isInclusive: boolean }[];
  settings: {
    defaultCurrency: string;
    quotationValidityDays: number;
    defaultTerms: string | null;
    taxTreatment: string;
  } | null;
};

type Line = {
  key: string;
  productId: string;
  name: string;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  discountType: DiscountType;
  discountValue: string;
  taxRateId: string;
};

type Charge = { key: string; label: string; amount: string; taxable: boolean };
type Milestone = { key: string; label: string; percent: string; dueOn: string };

const uid = () => Math.random().toString(36).slice(2, 10);

function emptyLine(): Line {
  return {
    key: uid(),
    productId: "",
    name: "",
    description: "",
    unit: "unit",
    quantity: "1",
    unitPrice: "0",
    discountType: "none",
    discountValue: "0",
    taxRateId: "",
  };
}

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function QuotationForm({
  quotation,
  initialLines,
  options,
}: {
  quotation?: {
    id: string;
    customerId: string;
    issueDate: string;
    expiryDate: string | null;
    currency: string;
    customerPo: string | null;
    notes: string | null;
    terms: string | null;
    internalNotes: string | null;
    documentDiscountType: DiscountType;
    documentDiscountValue: string;
  };
  initialLines?: {
    productId: string | null;
    name: string;
    description: string | null;
    unit: string;
    quantity: string;
    unitPrice: string;
    discountType: DiscountType;
    discountValue: string;
    taxRateId: string | null;
  }[];
  options: Options;
}) {
  const [state, formAction, pending] = useActionState(saveQuotationAction, INITIAL);
  const router = useRouter();
  const linesRef = useRef<HTMLInputElement>(null);
  const chargesRef = useRef<HTMLInputElement>(null);
  const milestonesRef = useRef<HTMLInputElement>(null);

  const validity = options.settings?.quotationValidityDays ?? 14;

  useEffect(() => {
    if (state.ok && state.id && !state.invoiceId) {
      router.push(`/quotations/${state.id}`);
      router.refresh();
    }
  }, [state, router]);

  const [lines, setLines] = useState<Line[]>(
    initialLines && initialLines.length > 0
      ? initialLines.map((l) => ({
          key: uid(),
          productId: l.productId ?? "",
          name: l.name,
          description: l.description ?? "",
          unit: l.unit,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountType: l.discountType,
          discountValue: l.discountValue,
          taxRateId: l.taxRateId ?? "",
        }))
      : [emptyLine()]
  );
  const [charges, setCharges] = useState<Charge[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [docDiscountType, setDocDiscountType] = useState<DiscountType>(
    quotation?.documentDiscountType ?? "none"
  );
  const [docDiscountValue, setDocDiscountValue] = useState(
    quotation?.documentDiscountValue ?? "0"
  );
  const [customerId, setCustomerId] = useState(quotation?.customerId ?? "");
  const [taxExempt, setTaxExempt] = useState(false);

  const rateById = useMemo(
    () => new Map(options.rates.map((r) => [r.id, r])),
    [options.rates]
  );

  /* Live preview — the exact same engine the server uses. */
  const totals = useMemo(() => {
    return calculateDocument({
      lines: lines.map((l) => {
        const rate = !taxExempt && l.taxRateId ? rateById.get(l.taxRateId) : undefined;
        return {
          quantity: l.quantity || "0",
          unitPrice: l.unitPrice || "0",
          discountType: l.discountType,
          discountValue: l.discountValue || "0",
          taxRate: rate ? rate.rate : 0,
          taxInclusive: rate ? rate.isInclusive : false,
        };
      }),
      charges: charges.map((c) => ({
        amount: c.amount || "0",
        taxable: c.taxable,
        taxRate: 0,
      })),
      documentDiscount: { type: docDiscountType, value: docDiscountValue || "0" },
      currency: quotation?.currency ?? options.settings?.defaultCurrency ?? "MYR",
    });
  }, [lines, charges, docDiscountType, docDiscountValue, rateById, taxExempt, options.settings, quotation]);

  function onCustomerChange(id: string | null) {
    setCustomerId(id ?? "");
    const c = options.customers.find((x) => x.id === id);
    if (c?.taxExempt) {
      setTaxExempt(true);
      setLines((ls) => ls.map((l) => ({ ...l, taxRateId: "" })));
    } else {
      setTaxExempt(false);
    }
  }

  function onProductChange(key: string, productId: string) {
    setLines((ls) =>
      ls.map((l) => {
        if (l.key !== key) return l;
        if (!productId) return { ...l, productId: "" };
        const p = options.products.find((x) => x.id === productId);
        if (!p) return { ...l, productId };
        return {
          ...l,
          productId,
          name: p.name,
          unit: p.unit,
          unitPrice: p.unitPrice,
          discountType: p.discountType,
          discountValue: p.discountValue,
          taxRateId: p.taxRateId ?? "",
          description: p.description ?? "",
        };
      })
    );
  }

  const patchLine = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  function handleSubmit() {
    // Serialise the editors into the FormData right before submission.
    if (linesRef.current) linesRef.current.value = JSON.stringify(lines);
    if (chargesRef.current) chargesRef.current.value = JSON.stringify(charges);
    if (milestonesRef.current) milestonesRef.current.value = JSON.stringify(milestones);
  }

  const duplicateError = state.error?.toLowerCase().includes("duplicate");

  return (
    <form action={formAction} className="space-y-6" onSubmit={handleSubmit} noValidate>
      {quotation?.id ? <input type="hidden" name="id" value={quotation.id} /> : null}
      <input type="hidden" name="linesJson" ref={linesRef} defaultValue="[]" />
      <input type="hidden" name="chargesJson" ref={chargesRef} defaultValue="[]" />
      <input type="hidden" name="milestonesJson" ref={milestonesRef} defaultValue="[]" />
      <input type="hidden" name="documentDiscountType" value={docDiscountType} />
      <input type="hidden" name="documentDiscountValue" value={docDiscountValue} />

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
        <div
          role="alert"
          className={
            duplicateError
              ? "rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
              : "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          }
        >
          {state.error}
        </div>
      ) : null}

      {/* Header ------------------------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="customerId">
            Customer <span className="text-red-600">*</span>
          </Label>
          <Select name="customerId" value={customerId} onValueChange={onCustomerChange}>
            <SelectTrigger id="customerId">
              <SelectValue placeholder="Select a customer" />
            </SelectTrigger>
            <SelectContent>
              {options.customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Input
            id="currency"
            name="currency"
            maxLength={3}
            defaultValue={quotation?.currency ?? options.settings?.defaultCurrency ?? "MYR"}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="issueDate">
            Issue date <span className="text-red-600">*</span>
          </Label>
          <Input
            id="issueDate"
            name="issueDate"
            type="date"
            required
            defaultValue={quotation?.issueDate ?? new Date().toISOString().slice(0, 10)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="expiryDate">Valid until</Label>
          <Input
            id="expiryDate"
            name="expiryDate"
            type="date"
            defaultValue={quotation?.expiryDate ?? todayPlus(validity)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="customerPo">Customer reference / PO</Label>
          <Input
            id="customerPo"
            name="customerPo"
            maxLength={60}
            defaultValue={quotation?.customerPo ?? ""}
          />
        </div>
      </div>

      {taxExempt ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This customer is tax exempt — all lines are calculated without tax.
        </p>
      ) : null}

      {/* Lines -------------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Line items</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLines((ls) => [...ls, emptyLine()])}
          >
            <Plus className="mr-1 h-4 w-4" /> Add line
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-2 font-medium">Item</th>
                <th className="px-2 py-2 font-medium">Description</th>
                <th className="px-2 py-2 font-medium">Qty</th>
                <th className="px-2 py-2 font-medium">Unit</th>
                <th className="px-2 py-2 font-medium">Price</th>
                <th className="px-2 py-2 font-medium">Disc %</th>
                <th className="px-2 py-2 font-medium">Tax</th>
                <th className="px-2 py-2 text-right font-medium">Total</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.key} className="border-t border-slate-100 align-top">
                  <td className="px-2 py-2">
                    <select
                      className="mb-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      value={l.productId}
                      onChange={(e) => onProductChange(l.key, e.target.value)}
                      aria-label={`Catalogue item for line ${i + 1}`}
                    >
                      <option value="">Custom line…</option>
                      {options.products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku ? `${p.sku} — ` : ""}
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={l.name}
                      onChange={(e) => patchLine(l.key, { name: e.target.value })}
                      placeholder="Line name *"
                      aria-label={`Line ${i + 1} name`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Textarea
                      value={l.description}
                      onChange={(e) => patchLine(l.key, { description: e.target.value })}
                      rows={2}
                      placeholder="Optional"
                      aria-label={`Line ${i + 1} description`}
                      className="min-w-[160px]"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={l.quantity}
                      onChange={(e) => patchLine(l.key, { quantity: e.target.value })}
                      inputMode="decimal"
                      className="w-20"
                      aria-label={`Line ${i + 1} quantity`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={l.unit}
                      onChange={(e) => patchLine(l.key, { unit: e.target.value })}
                      className="w-20"
                      aria-label={`Line ${i + 1} unit`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={l.unitPrice}
                      onChange={(e) => patchLine(l.key, { unitPrice: e.target.value })}
                      inputMode="decimal"
                      className="w-28"
                      aria-label={`Line ${i + 1} unit price`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={l.discountType === "percent" ? l.discountValue : ""}
                      onChange={(e) =>
                        patchLine(l.key, {
                          discountType: e.target.value ? "percent" : "none",
                          discountValue: e.target.value || "0",
                        })
                      }
                      inputMode="decimal"
                      className="w-16"
                      aria-label={`Line ${i + 1} discount percent`}
                      placeholder="0"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      className="w-28 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      value={taxExempt ? "" : l.taxRateId}
                      disabled={taxExempt}
                      onChange={(e) => patchLine(l.key, { taxRateId: e.target.value })}
                      aria-label={`Line ${i + 1} tax rate`}
                    >
                      <option value="">No tax</option>
                      {options.rates.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.rate}%)
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-700">
                    {formatMoney(totals.lines[i]?.total ?? "0")}
                  </td>
                  <td className="px-1 py-2">
                    <button
                      type="button"
                      aria-label={`Remove line ${i + 1}`}
                      onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      disabled={lines.length === 1}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">
          Discounts are per-line percent; totals update live and are recalculated on the server.
        </p>
      </div>

      {/* Charges + document discount ---------------------------------- */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Additional charges</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setCharges((cs) => [
                  ...cs,
                  { key: uid(), label: "", amount: "0", taxable: false },
                ])
              }
            >
              <Plus className="mr-1 h-4 w-4" /> Add charge
            </Button>
          </div>
          {charges.map((c) => (
            <div key={c.key} className="flex items-center gap-2">
              <Input
                value={c.label}
                placeholder="Label (e.g. Delivery)"
                onChange={(e) =>
                  setCharges((cs) =>
                    cs.map((x) => (x.key === c.key ? { ...x, label: e.target.value } : x))
                  )
                }
                aria-label="Charge label"
              />
              <Input
                value={c.amount}
                inputMode="decimal"
                className="w-28"
                onChange={(e) =>
                  setCharges((cs) =>
                    cs.map((x) => (x.key === c.key ? { ...x, amount: e.target.value } : x))
                  )
                }
                aria-label="Charge amount"
              />
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={c.taxable}
                  onChange={(e) =>
                    setCharges((cs) =>
                      cs.map((x) =>
                        x.key === c.key ? { ...x, taxable: e.target.checked } : x
                      )
                    )
                  }
                />
                Taxable
              </label>
              <button
                type="button"
                aria-label="Remove charge"
                onClick={() => setCharges((cs) => cs.filter((x) => x.key !== c.key))}
                className="rounded p-1 text-slate-400 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
            <Label htmlFor="docDiscount" className="text-sm shrink-0">
              Document discount
            </Label>
            <select
              id="docDiscount"
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              value={docDiscountType}
              onChange={(e) => setDocDiscountType(e.target.value as DiscountType)}
            >
              <option value="none">None</option>
              <option value="percent">%</option>
              <option value="amount">Amount</option>
            </select>
            <Input
              inputMode="decimal"
              className="w-24"
              disabled={docDiscountType === "none"}
              value={docDiscountValue}
              onChange={(e) => setDocDiscountValue(e.target.value)}
              aria-label="Document discount value"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Payment milestones</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setMilestones((ms) => [...ms, { key: uid(), label: "", percent: "50", dueOn: "" }])
              }
            >
              <Plus className="mr-1 h-4 w-4" /> Add milestone
            </Button>
          </div>
          {milestones.map((m) => (
            <div key={m.key} className="flex items-center gap-2">
              <Input
                value={m.label}
                placeholder="e.g. Deposit"
                onChange={(e) =>
                  setMilestones((ms) =>
                    ms.map((x) => (x.key === m.key ? { ...x, label: e.target.value } : x))
                  )
                }
                aria-label="Milestone label"
              />
              <Input
                value={m.percent}
                inputMode="decimal"
                className="w-20"
                onChange={(e) =>
                  setMilestones((ms) =>
                    ms.map((x) => (x.key === m.key ? { ...x, percent: e.target.value } : x))
                  )
                }
                aria-label="Milestone percent"
              />
              <span className="text-xs text-slate-500">% </span>
              <Input
                type="date"
                value={m.dueOn}
                onChange={(e) =>
                  setMilestones((ms) =>
                    ms.map((x) => (x.key === m.key ? { ...x, dueOn: e.target.value } : x))
                  )
                }
                aria-label="Milestone due date"
              />
              <button
                type="button"
                aria-label="Remove milestone"
                onClick={() => setMilestones((ms) => ms.filter((x) => x.key !== m.key))}
                className="rounded p-1 text-slate-400 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Totals ------------------------------------------------------- */}
      <div className="flex justify-end">
        <div className="w-full max-w-sm space-y-1 rounded-xl bg-slate-50 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span className="tabular-nums">{formatMoney(totals.lineSubtotal)}</span>
          </div>
          {Number(totals.discountTotal) > 0 ? (
            <div className="flex justify-between">
              <span className="text-slate-500">Discount</span>
              <span className="tabular-nums text-red-600">−{formatMoney(totals.discountTotal)}</span>
            </div>
          ) : null}
          <div className="flex justify-between">
            <span className="text-slate-500">Charges</span>
            <span className="tabular-nums">{formatMoney(totals.chargesTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Tax</span>
            <span className="tabular-nums">{formatMoney(totals.taxTotal)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900">
            <span>Grand total</span>
            <span className="tabular-nums">{formatMoney(totals.grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Text --------------------------------------------------------- */}
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="terms">Terms &amp; conditions</Label>
          <Textarea
            id="terms"
            name="terms"
            rows={4}
            defaultValue={quotation?.terms ?? options.settings?.defaultTerms ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Notes to customer</Label>
          <Textarea id="notes" name="notes" rows={2} defaultValue={quotation?.notes ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="internalNotes">Internal notes</Label>
          <Textarea
            id="internalNotes"
            name="internalNotes"
            rows={2}
            defaultValue={quotation?.internalNotes ?? ""}
          />
          <p className="text-xs text-slate-500">Never printed on the document.</p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {quotation?.id ? "Save changes" : "Save as draft"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
      {state.ok && state.number ? (
        <p className="text-sm text-emerald-700">Saved as {state.number}.</p>
      ) : null}
    </form>
  );
}
