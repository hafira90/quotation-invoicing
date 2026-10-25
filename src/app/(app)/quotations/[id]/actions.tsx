"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  convertQuotationToInvoiceAction,
  duplicateQuotationAction,
  quotationTransitionAction,
  type QuotationTransition,
} from "@/lib/actions/quotations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Flags = {
  status: string;
  canEdit: boolean;
  canIssue: boolean;
  canSend: boolean;
  canDecide: boolean;
  canConvert: boolean;
  canCancel: boolean;
  canDuplicate: boolean;
};

export function QuotationActions({ id, flags }: { id: string; flags: Flags }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<null | "accept" | "reject">(null);
  const [acceptanceName, setAcceptanceName] = useState("");
  const [acceptanceDesignation, setAcceptanceDesignation] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  async function run(transition: QuotationTransition, payload?: Record<string, string>) {
    setBusy(true);
    try {
      const res = await quotationTransitionAction(id, transition, payload);
      if (res.ok) {
        const labels: Record<QuotationTransition, string> = {
          issue: "issued",
          send: "marked as sent",
          accept: "accepted",
          reject: "rejected",
          expire: "marked expired",
          cancel: "cancelled",
        };
        toast.success(`Quotation ${labels[transition]}`);
        setMode(null);
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not update the quotation");
      }
    } finally {
      setBusy(false);
    }
  }

  async function convert() {
    setBusy(true);
    try {
      const res = await convertQuotationToInvoiceAction(id);
      if (res.ok) {
        toast.success(`Invoice ${res.number} created`);
        router.push(`/quotations/${id}`);
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not convert the quotation");
      }
    } finally {
      setBusy(false);
    }
  }

  async function duplicate() {
    setBusy(true);
    try {
      const res = await duplicateQuotationAction(id);
      if (res.ok && res.id) {
        toast.success(`Copied as ${res.number}`);
        router.push(`/quotations/${res.id}/edit`);
      } else {
        toast.error(res.error ?? "Could not duplicate the quotation");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {flags.canEdit ? (
          <Button size="sm" render={<Link href={`/quotations/${id}/edit`} />}>
            Edit
          </Button>
        ) : null}
        {flags.canIssue ? (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => run("issue")}>
            Issue
          </Button>
        ) : null}
        {flags.canSend ? (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => run("send")}>
            Mark as sent
          </Button>
        ) : null}
        {flags.canDecide ? (
          <>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setMode("accept")}>
              Accept
            </Button>
            <Button size="sm" variant="destructive" disabled={busy} onClick={() => setMode("reject")}>
              Reject
            </Button>
          </>
        ) : null}
        {flags.canConvert ? (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  "Convert this accepted quotation to an invoice? The quotation will be locked as converted."
                )
              )
                convert();
            }}
          >
            Convert to invoice
          </Button>
        ) : null}
        {flags.canDuplicate ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={duplicate}>
            Duplicate
          </Button>
        ) : null}
        {flags.canCancel ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Cancel this quotation? It stays on record.")) run("cancel");
            }}
          >
            Cancel quotation
          </Button>
        ) : null}
      </div>

      {mode === "accept" ? (
        <form
          className="flex flex-wrap items-end gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            run("accept", { acceptanceName, acceptanceDesignation });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="acceptanceName">Accepted by (name) *</Label>
            <Input
              id="acceptanceName"
              value={acceptanceName}
              onChange={(e) => setAcceptanceName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acceptanceDesignation">Designation</Label>
            <Input
              id="acceptanceDesignation"
              value={acceptanceDesignation}
              onChange={(e) => setAcceptanceDesignation(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              Confirm acceptance
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setMode(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {mode === "reject" ? (
        <form
          className="flex flex-wrap items-end gap-3 rounded-lg border border-red-200 bg-red-50 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            run("reject", { rejectionReason });
          }}
        >
          <div className="min-w-[280px] flex-1 space-y-1.5">
            <Label htmlFor="rejectionReason">Rejection reason *</Label>
            <Input
              id="rejectionReason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              required
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="destructive" disabled={busy}>
              Record rejection
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setMode(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
