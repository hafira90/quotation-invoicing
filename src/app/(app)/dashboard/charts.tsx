"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyCompact } from "@/lib/format";

interface MonthPoint {
  month: string;
  invoiced: number;
  collected: number;
}

function label(month: string): string {
  const [year, m] = month.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const idx = Number(m) - 1;
  return `${names[idx] ?? m} ${year.slice(2)}`;
}

export function Charts({ monthly }: { monthly: MonthPoint[] }) {
  const data = monthly.map((m) => ({ ...m, label: label(m.month) }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoiced vs collected</CardTitle>
          <p className="text-xs text-slate-500">
            Issued invoice value compared with cash recorded, last 12 months.
          </p>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => formatMoneyCompact(Number(v))} />
              <Tooltip
                formatter={(value) => formatMoneyCompact(Number(value))}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="invoiced" name="Invoiced" stroke="#0f172a" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="collected" name="Collected" stroke="#059669" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly collections</CardTitle>
          <p className="text-xs text-slate-500">
            Payments recorded per month. Cash in, not invoice value.
          </p>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => formatMoneyCompact(Number(v))} />
              <Tooltip
                formatter={(value) => formatMoneyCompact(Number(value))}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="collected" name="Collected" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
