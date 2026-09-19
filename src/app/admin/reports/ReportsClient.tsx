"use client";

import { useEffect, useState, useCallback } from "react";
import Shell from "@/components/Shell";
import type { ServerSession } from "@/lib/serverSession";
import { apiGet, downloadFile } from "@/lib/apiClient";
import { TableSkeleton } from "@/components/Skeleton";

function currentMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function ReportsClient({ session }: { session: ServerSession }) {
  const [tab, setTab] = useState<"daily" | "monthly" | "department">("monthly");
  const [date, setDate] = useState(todayStr());
  const [month, setMonth] = useState(currentMonth());
  const [daily, setDaily] = useState<any>(null);
  const [monthly, setMonthly] = useState<any>(null);
  const [dept, setDept] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    if (tab === "daily") { const r = await apiGet(`/api/reports/daily?date=${date}`); if (r.success) setDaily(r.data); }
    if (tab === "monthly") { const r = await apiGet(`/api/reports/monthly?month=${month}`); if (r.success) setMonthly(r.data); }
    if (tab === "department") { const r = await apiGet(`/api/reports/department?month=${month}`); if (r.success) setDept(r.data); }
    setLoading(false);
  }, [tab, date, month]);

  useEffect(() => { load(); }, [load]);


  return (
    <Shell role={session.role} name={session.name}>
      <h1 className="text-xl font-semibold text-ink-900 mb-4">Reports</h1>

      <div className="flex gap-2 mb-4">
        {(["daily", "monthly", "department"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`btn ${tab === t ? "btn-primary" : "btn-secondary"}`}>
            {t[0].toUpperCase() + t.slice(1)} Report
          </button>
        ))}
      </div>

      {tab === "daily" && (
        <>
          <div className="card p-4 mb-4 flex items-end gap-3">
            <div><label className="label">Date</label><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <button className="btn btn-secondary" onClick={() => downloadFile(`/api/export/excel?report=daily&date=${date}`)}>⬇ Excel</button>
            <button className="btn btn-secondary" onClick={() => downloadFile(`/api/export/pdf?report=daily&date=${date}`)}>⬇ PDF</button>
          </div>
          {loading ? (
            <TableSkeleton rows={10} cols={2} />
          ) : daily && (
            <div className="card overflow-hidden">
              <table className="data-table">
                <tbody>
                  {Object.entries({
                    "Active Employees": daily.activeEmployees, "Requested": daily.requested, "Not Requested": daily.notRequested,
                    "No Response": daily.noResponse, "Expected Meals": daily.expectedMeals, "Served": daily.served,
                    "Not Served": daily.notServed, "Extra": daily.extra, "Meal Cost": `৳${daily.mealCost.toFixed(2)}`, "Collected": `৳${daily.collected.toFixed(2)}`
                  }).map(([k, v]) => (
                    <tr key={k}><td className="font-medium text-ink-600 w-64">{k}</td><td>{v as any}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "monthly" && (
        <>
          <div className="card p-4 mb-4 flex items-end gap-3">
            <div><label className="label">Month</label><input type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
            <button className="btn btn-secondary" onClick={() => downloadFile(`/api/export/excel?report=monthly&month=${month}`)}>⬇ Excel</button>
            <button className="btn btn-secondary" onClick={() => downloadFile(`/api/export/pdf?report=monthly&month=${month}`)}>⬇ PDF</button>
          </div>
          {loading ? (
            <TableSkeleton rows={8} cols={11} />
          ) : monthly && (
            <div className="card overflow-hidden">
              <table className="data-table">
                <thead><tr><th>ID</th><th>Name</th><th>Dept</th><th>Eligible</th><th>Req</th><th>Served</th><th>Not Served</th><th>Cost</th><th>Paid</th><th>Outstanding</th><th>Status</th></tr></thead>
                <tbody>
                  {monthly.rows.map((r: any) => (
                    <tr key={r.employeeId}>
                      <td>{r.employeeCode}</td><td>{r.name}</td><td>{r.department}</td><td>{r.eligibleDays}</td>
                      <td>{r.requested}</td><td>{r.served}</td><td>{r.notServed}</td>
                      <td>৳{r.mealCost.toFixed(2)}</td><td>৳{r.paid.toFixed(2)}</td><td>৳{r.outstanding.toFixed(2)}</td><td>{r.paymentStatus}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold bg-ink-50">
                    <td colSpan={4}>TOTAL</td><td>{monthly.totals.requested}</td><td>{monthly.totals.served}</td><td>{monthly.totals.notServed}</td>
                    <td>৳{monthly.totals.mealCost.toFixed(2)}</td><td>৳{monthly.totals.paid.toFixed(2)}</td><td>৳{monthly.totals.outstanding.toFixed(2)}</td><td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "department" && (
        <>
          <div className="card p-4 mb-4 flex items-end gap-3">
            <div><label className="label">Month</label><input type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
            <button className="btn btn-secondary" onClick={() => downloadFile(`/api/export/excel?report=department&month=${month}`)}>⬇ Excel</button>
            <button className="btn btn-secondary" onClick={() => downloadFile(`/api/export/pdf?report=department&month=${month}`)}>⬇ PDF</button>
          </div>
          {loading ? (
            <TableSkeleton rows={6} cols={9} />
          ) : (
          <div className="card overflow-hidden">
            <table className="data-table">
              <thead><tr><th>Department</th><th>Employees</th><th>Requested</th><th>Served</th><th>Not Served</th><th>Meal Cost</th><th>Paid</th><th>Outstanding</th><th>Consumption %</th></tr></thead>
              <tbody>
                {dept.map((d) => (
                  <tr key={d.department}>
                    <td>{d.department}</td><td>{d.totalEmployees}</td><td>{d.requested}</td><td>{d.served}</td><td>{d.notServed}</td>
                    <td>৳{d.mealCost.toFixed(2)}</td><td>৳{d.paid.toFixed(2)}</td><td>৳{d.outstanding.toFixed(2)}</td><td>{d.consumptionPercentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </>
      )}
    </Shell>
  );
}
