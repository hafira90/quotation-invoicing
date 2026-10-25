"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { saveCustomerAction, type CustomerActionState } from "@/lib/actions/customers";
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

const INITIAL: CustomerActionState = { ok: true };

type Customer = {
  id?: string;
  customerType: "individual" | "company";
  name: string;
  legalName: string | null;
  registrationNumber: string | null;
  taxRegistrationNumber: string | null;
  billingAddress: string | null;
  shippingAddress: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  customerReference: string | null;
  paymentTermsDays: number | null;
  defaultCurrency: string | null;
  taxTreatment: "exclusive" | "inclusive" | null;
  taxExempt: boolean | null;
  taxExemptionReason: string | null;
  notes: string | null;
};

export function CustomerForm({ customer }: { customer?: Customer }) {
  const [state, formAction, pending] = useActionState(saveCustomerAction, INITIAL);
  const router = useRouter();

  useEffect(() => {
    if (state.ok && state.saved) {
      toast.success(customer?.id ? "Customer updated" : "Customer created");
      router.push(state.id ? `/customers/${state.id}` : "/customers");
      router.refresh();
    }
  }, [state, router, customer?.id]);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {customer?.id ? <input type="hidden" name="id" value={customer.id} /> : null}
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
          <Label htmlFor="customerType">Customer type</Label>
          <Select name="customerType" defaultValue={customer?.customerType ?? "company"}>
            <SelectTrigger id="customerType">
              <SelectValue placeholder="Company" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="company">Company</SelectItem>
              <SelectItem value="individual">Individual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">
            {customer?.customerType === "individual" ? "Customer name" : "Company name"}{" "}
            <span className="text-red-600">*</span>
          </Label>
          <Input id="name" name="name" defaultValue={customer?.name ?? ""} required maxLength={200} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="legalName">Legal entity name</Label>
          <Input id="legalName" name="legalName" defaultValue={customer?.legalName ?? ""} maxLength={200} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="registrationNumber">Company registration no.</Label>
          <Input
            id="registrationNumber"
            name="registrationNumber"
            defaultValue={customer?.registrationNumber ?? ""}
            maxLength={60}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="taxRegistrationNumber">Tax registration no. (SST)</Label>
          <Input
            id="taxRegistrationNumber"
            name="taxRegistrationNumber"
            defaultValue={customer?.taxRegistrationNumber ?? ""}
            maxLength={60}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contactPerson">Contact person</Label>
          <Input
            id="contactPerson"
            name="contactPerson"
            defaultValue={customer?.contactPerson ?? ""}
            maxLength={120}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={customer?.email ?? ""} maxLength={200} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={customer?.phone ?? ""} maxLength={40} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="customerReference">Customer reference / PO</Label>
          <Input
            id="customerReference"
            name="customerReference"
            defaultValue={customer?.customerReference ?? ""}
            maxLength={60}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="paymentTermsDays">Payment terms (days)</Label>
          <Input
            id="paymentTermsDays"
            name="paymentTermsDays"
            type="number"
            min={0}
            max={365}
            defaultValue={customer?.paymentTermsDays ?? ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="defaultCurrency">Currency</Label>
          <Input
            id="defaultCurrency"
            name="defaultCurrency"
            maxLength={3}
            placeholder="MYR"
            defaultValue={customer?.defaultCurrency ?? ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="taxTreatment">Tax treatment</Label>
          <Select name="taxTreatment" defaultValue={customer?.taxTreatment ?? undefined}>
            <SelectTrigger id="taxTreatment">
              <SelectValue placeholder="Use company default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="exclusive">Tax exclusive (add tax)</SelectItem>
              <SelectItem value="inclusive">Tax inclusive (prices include tax)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="billingAddress">Billing address</Label>
        <Textarea
          id="billingAddress"
          name="billingAddress"
          rows={3}
          defaultValue={customer?.billingAddress ?? ""}
          maxLength={2000}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="shippingAddress">Shipping / service address</Label>
        <Textarea
          id="shippingAddress"
          name="shippingAddress"
          rows={3}
          defaultValue={customer?.shippingAddress ?? ""}
          maxLength={2000}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Internal notes</Label>
        <Textarea id="notes" name="notes" rows={3} defaultValue={customer?.notes ?? ""} maxLength={5000} />
        <p className="text-xs text-slate-500">Never shown on quotations, invoices or PDFs.</p>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="taxExempt"
          name="taxExempt"
          type="checkbox"
          defaultChecked={customer?.taxExempt ?? false}
          className="h-4 w-4 rounded border-slate-300"
        />
        <Label htmlFor="taxExempt" className="font-normal">
          Tax exempt for this customer
        </Label>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {customer?.id ? "Save changes" : "Create customer"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
