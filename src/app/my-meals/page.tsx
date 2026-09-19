"use client";

import { useEffect, useState, useCallback } from "react";
import Shell from "@/components/Shell";
import Badge from "@/components/Badge";
import { useSession } from "@/lib/useSession";
import { apiGet, downloadFile } from "@/lib/apiClient";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function MyMealsPage() {
  const { session, loading } = useSession(["EMPLOYEE"]);
  const [month, setMonth] = useState(currentMonth());
  const [bill, setBill] = useState<any>(null);

  const load = useCallback(async () => {
    if (!session?.employeeId) return;
    const res = await apiGet(`/api/reports/employee/${session.employeeId}?month=${month}`);
    if (res.success) setBill(res.data);
  }, [session, month]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !session) return <div className="p-8 text-ink-400">Loading…</div>;

  return (
    <Shell role={session.role} name={session.name}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h1 className="text-xl font-semibold text-ink-900">My Meal &amp; Payments</h1>
        <div className="flex items-center gap-2">
          <input type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} />
          <button
            className="btn btn-secondary"
            onClick={() => downloadFile(`/api/export/excel?report=employee-bill&month=${month}`, `bill-${month}.xlsx`)}
          >
            ⬇ Excel
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => downloadFile(`/api/export/pdf?report=employee-bill&month=${month}`, `bill-${month}.pdf`)}
          >
            ⬇ PDF
          </button>
        </div>
      </div>

      {bill?.settlement && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Stat label="Meals Served" value={bill.settlement.mealsServed} />
          <Stat label="Meal Cost" value={`৳${Number(bill.settlement.mealCost).toFixed(2)}`} />
          <Stat label="Paid" value={`৳${Number(bill.settlement.paymentsThisMonth).toFixed(2)}`} />
          <Stat label="Outstanding" value={`৳${Number(bill.settlement.outstanding).toFixed(2)}`} accent="text-red-600" />
          <Stat label="Status" value={<Badge status={bill.settlement.paymentStatus} />} />
        </div>
      )}

      <h2 className="text-lg font-semibold text-ink-900 mb-2">Meal History</h2>
      <div className="card overflow-hidden mb-6">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th><th>Meal</th><th>Status</th><th>Unit Price</th><th>Charge</th>
            </tr>
          </thead>
          <tbody>
            {(bill?.consumptions ?? []).length === 0 ? (
              <tr><td colSpan={5} className="text-center text-ink-400 py-6">No records for this month.</td></tr>
            ) : (
              bill.consumptions.map((c: any) => (
                <tr key={c.id}>
                  <td>{new Date(c.date).toDateString()}</td>
                  <td>{c.mealType.name}</td>
                  <td><Badge status={c.servingStatus} /></td>
                  <td>{c.unitPriceApplied ? `৳${Number(c.unitPriceApplied).toFixed(2)}` : "-"}</td>
                  <td>৳{Number(c.chargeAmount).toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-semibold text-ink-900 mb-2">Payment History</h2>
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th><th>Amount</th><th>Method</th><th>Reference</th><th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {(bill?.payments ?? []).length === 0 ? (
              <tr><td colSpan={5} className="text-center text-ink-400 py-6">No payments recorded for this month.</td></tr>
            ) : (
              bill.payments.map((p: any) => (
                <tr key={p.id}>
                  <td>{new Date(p.paymentDate).toDateString()}</td>
                  <td>৳{Number(p.amount).toFixed(2)}</td>
                  <td>{p.method.replaceAll("_", " ")}</td>
                  <td>{p.referenceNo || "-"}</td>
                  <td>{p.remarks || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-ink-500">{label}</div>
      <div className={`text-xl font-semibold mt-1 ${accent || "text-ink-900"}`}>{value}</div>
    </div>
  );
}
