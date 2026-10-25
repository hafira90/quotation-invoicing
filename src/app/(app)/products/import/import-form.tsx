"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";

import {
  importProductsAction,
  type ImportResultState,
} from "@/lib/actions/products";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const INITIAL: ImportResultState = {
  ok: false,
  imported: 0,
  skipped: 0,
  rows: [],
};

export function ImportForm() {
  const [state, formAction, pending] = useActionState(importProductsAction, INITIAL);
  const [fileName, setFileName] = useState("");
  const router = useRouter();

  const done = state.ok && !pending;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {!state.ok && state.error ? (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="file">CSV file</Label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
          className="block w-full cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:font-medium"
        />
        {fileName ? <p className="text-xs text-slate-500">{fileName}</p> : null}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Import
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/products")}>
          Cancel
        </Button>
      </div>

      {done ? (
        <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-800">
            Imported {state.imported} item{state.imported === 1 ? "" : "s"}
            {state.skipped > 0 ? `, skipped ${state.skipped}` : ""}.
          </p>
          {state.error ? (
            <p className="text-sm text-amber-700">{state.error}</p>
          ) : null}

          {state.rows.length > 0 ? (
            <div className="max-h-72 overflow-y-auto rounded border border-slate-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Row</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {state.rows.map((r) => (
                    <tr key={r.row} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-1.5 tabular-nums text-slate-500">{r.row}</td>
                      <td className="px-3 py-1.5 text-slate-700">{r.name ?? "—"}</td>
                      <td
                        className={
                          r.ok
                            ? "px-3 py-1.5 text-emerald-700"
                            : "px-3 py-1.5 text-red-700"
                        }
                      >
                        {r.ok ? "Imported" : r.error}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <Button type="button" size="sm" render={<a href="/api/products/export" />}>
            Download updated catalogue (CSV)
          </Button>
        </div>
      ) : null}
    </form>
  );
}
