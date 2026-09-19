"use client";

import { useEffect, useState, useCallback } from "react";
import Shell from "@/components/Shell";
import Badge from "@/components/Badge";
import Pagination from "@/components/Pagination";
import type { ServerSession } from "@/lib/serverSession";
import { apiGet, apiPost, downloadFile } from "@/lib/apiClient";
import { useToast } from "@/components/Toast";
import { TableSkeleton, StatGridSkeleton } from "@/components/Skeleton";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function SettlementClient({ session }: { session: ServerSession }) {
  const toast = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, pageSize: 25 });
  const [departments, setDepartments] = useState<any[]>([]);
  const [recomputing, setRecomputing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { apiGet("/api/departments").then((r) => r.success && setDepartments(r.data)); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      month, page: String(page), pageSize: "25",
      ...(departmentId ? { departmentId } : {}), ...(status ? { status } : {}), ...(search ? { search } : {})
    });
    const res = await apiGet(`/api/settlement?${params}`);
    if (res.success) {
      setRows(res.data.settlements);
      setTotals(res.data.totals);
      setMeta({ total: res.data.total, totalPages: res.data.totalPages, pageSize: res.data.pageSize });
    }
    setLoading(false);
  }, [month, page, departmentId, status, search]);

  useEffect(() => { load(); }, [load]);

  async function recompute() {
    setRecomputing(true);
    const res = await apiPost("/api/settlement", { month });
    setRecomputing(false);
    if (!res.success) toast(res.message, "error");
    else toast(`Recomputed settlements for ${month}`);
    load();
  }


  return (
    <Shell role={session.role} name={session.name}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h1 className="text-xl font-semibold text-ink-900">Monthly Settlement</h1>
        <div className="flex gap-2">
          <button className="btn btn-secondary" disabled={recomputing} onClick={recompute}>{recomputing ? "Recomputing…" : "↻ Recompute Month"}</button>
          <button className="btn btn-secondary" onClick={() => downloadFile(`/api/export/excel?report=monthly&month=${month}${departmentId ? `&departmentId=${departmentId}` : ""}`)}>⬇ Excel</button>
          <button className="btn btn-secondary" onClick={() => downloadFile(`/api/export/pdf?report=monthly&month=${month}${departmentId ? `&departmentId=${departmentId}` : ""}`)}>⬇ PDF</button>
        </div>
      </div>

      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div><label className="label">Month</label><input type="month" className="input" value={month} onChange={(e) => { setMonth(e.target.value); setPage(1); }} /></div>
        <div className="w-56">
          <label className="label">Department</label>
          <select className="input" value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setPage(1); }}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Payment Status</label>
          <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="PAID">Paid</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="UNPAID">Unpaid</option>
            <option value="OVERPAID">Overpaid</option>
          </select>
        </div>
        <div className="w-56"><label className="label">Search</label><input className="input" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Employee name / ID" /></div>
      </div>

      {loading ? (
        <>
          <StatGridSkeleton />
          <TableSkeleton rows={8} cols={9} />
        </>
      ) : (
        <>
          {totals && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <Stat label="Total Meal Cost" value={`৳${Number(totals._sum.mealCost || 0).toFixed(2)}`} />
              <Stat label="Total Collected" value={`৳${Number(totals._sum.paymentsThisMonth || 0).toFixed(2)}`} accent="text-emerald-600" />
              <Stat label="Total Outstanding" value={`৳${Number(totals._sum.outstanding || 0).toFixed(2)}`} accent="text-red-600" />
              <Stat label="Total Credit" value={`৳${Number(totals._sum.credit || 0).toFixed(2)}`} accent="text-brand-600" />
            </div>
          )}

          <div className="card overflow-hidden">
            <table className="data-table">
              <thead><tr><th>Emp ID</th><th>Name</th><th>Department</th><th>Meals</th><th>Meal Cost</th><th>Paid</th><th>Outstanding</th><th>Credit</th><th>Status</th></tr></thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={9} className="text-center text-ink-400 py-8">No settlement data for this filter yet. Try "Recompute Month".</td></tr>
                ) : (
                  rows.map((s) => (
                    <tr key={s.id}>
                      <td>{s.employee.employeeCode}</td>
                      <td>{s.employee.name}</td>
                      <td>{s.employee.department.name}</td>
                      <td>{s.mealsServed}</td>
                      <td>৳{Number(s.mealCost).toFixed(2)}</td>
                      <td>৳{Number(s.paymentsThisMonth).toFixed(2)}</td>
                      <td>৳{Number(s.outstanding).toFixed(2)}</td>
                      <td>৳{Number(s.credit).toFixed(2)}</td>
                      <td><Badge status={s.paymentStatus} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <Pagination page={page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPageChange={setPage} />
          </div>
        </>
      )}
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
