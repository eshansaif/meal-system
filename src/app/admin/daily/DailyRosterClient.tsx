"use client";

import { useEffect, useState, useCallback } from "react";
import Shell from "@/components/Shell";
import Badge from "@/components/Badge";
import Pagination from "@/components/Pagination";
import type { ServerSession } from "@/lib/serverSession";
import { apiGet, apiPost, downloadFile } from "@/lib/apiClient";
import { useToast } from "@/components/Toast";
import { TableSkeleton } from "@/components/Skeleton";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function DailyRosterClient({ session }: { session: ServerSession }) {
  const toast = useToast();
  const [mealTypeId, setMealTypeId] = useState<string>("");
  const [date, setDate] = useState(todayStr());
  const [search, setSearch] = useState("");
  const [responseFilter, setResponseFilter] = useState("");
  const [servingFilter, setServingFilter] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, pageSize: 25 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet("/api/meal-types").then((r) => {
      if (r.success && r.data?.length) setMealTypeId((prev) => prev || r.data.find((m: any) => m.code === "LUNCH")?.id || r.data[0].id);
    });
  }, []);

  const load = useCallback(async () => {
    if (!mealTypeId) return;
    setLoading(true);
    const params = new URLSearchParams({
      mealTypeId, date, page: String(page), pageSize: "25",
      ...(search ? { search } : {}), ...(responseFilter ? { responseFilter } : {}), ...(servingFilter ? { servingFilter } : {})
    });
    const res = await apiGet(`/api/serving?${params}`);
    if (res.success) {
      setRows(res.data.rows);
      setMeta({ total: res.data.total, totalPages: res.data.totalPages, pageSize: res.data.pageSize });
    }
    setLoading(false);
  }, [mealTypeId, date, page, search, responseFilter, servingFilter]);

  useEffect(() => { load(); }, [load]);

  function toggleAll() {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.employeeId)));
  }
  function toggleOne(id: string) {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  }

  async function bulkUpdate(servingStatus: string) {
    if (selected.size === 0) {
      toast("Select at least one employee first", "error");
      return;
    }
    const res = await apiPost("/api/serving", {
      mealTypeId, date, employeeIds: Array.from(selected), servingStatus
    });
    if (!res.success) {
      toast(res.message, "error");
      return;
    }
    toast(`${selected.size} record(s) marked ${servingStatus.replaceAll("_", " ")}`);
    setSelected(new Set());
    load();
  }


  return (
    <Shell role={session.role} name={session.name}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h1 className="text-xl font-semibold text-ink-900">Daily Meal Roster</h1>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => downloadFile(`/api/export/excel?report=daily&date=${date}&mealTypeId=${mealTypeId}`)}>⬇ Excel</button>
          <button className="btn btn-secondary" onClick={() => downloadFile(`/api/export/pdf?report=daily&date=${date}&mealTypeId=${mealTypeId}`)}>⬇ PDF (Catering sheet)</button>
        </div>
      </div>

      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} />
        </div>
        <div className="w-56">
          <label className="label">Search (ID / Name / Email)</label>
          <input className="input" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search employee…" />
        </div>
        <div>
          <label className="label">Response</label>
          <select className="input" value={responseFilter} onChange={(e) => { setResponseFilter(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="TAKING">Taking</option>
            <option value="NOT_TAKING">Not Taking</option>
            <option value="NO_RESPONSE">No Response</option>
          </select>
        </div>
        <div>
          <label className="label">Serving</label>
          <select className="input" value={servingFilter} onChange={(e) => { setServingFilter(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="SERVED">Served</option>
            <option value="NOT_SERVED">Not Served</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="EXTRA">Extra</option>
          </select>
        </div>
        {(search || responseFilter || servingFilter) && (
          <button className="btn btn-ghost" onClick={() => { setSearch(""); setResponseFilter(""); setServingFilter(""); }}>Clear filters</button>
        )}
      </div>

      {selected.size > 0 && (
        <div className="card p-3 mb-4 flex items-center gap-2 bg-brand-50 border-brand-100">
          <span className="text-sm text-brand-800 font-medium">{selected.size} selected</span>
          <button className="btn btn-primary" onClick={() => bulkUpdate("SERVED")}>Mark Served</button>
          <button className="btn btn-secondary" onClick={() => bulkUpdate("NOT_SERVED")}>Mark Not Served</button>
          <button className="btn btn-secondary" onClick={() => bulkUpdate("EXTRA")}>Mark Extra</button>
          <button className="btn btn-secondary" onClick={() => bulkUpdate("CANCELLED")}>Cancel</button>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={8} cols={8} />
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th><input type="checkbox" checked={rows.length > 0 && selected.size === rows.length} onChange={toggleAll} /></th>
                <th>Emp ID</th><th>Name</th><th>Department</th><th>Response</th><th>Serving Status</th><th>Unit Price</th><th>Charge</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-ink-400 py-8">No employees match the current filters.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.employeeId}>
                    <td><input type="checkbox" checked={selected.has(r.employeeId)} onChange={() => toggleOne(r.employeeId)} /></td>
                    <td>{r.employeeCode}</td>
                    <td>{r.name}</td>
                    <td>{r.department}</td>
                    <td><Badge status={r.responseStatus} /></td>
                    <td><Badge status={r.servingStatus} /></td>
                    <td>{r.unitPrice ? `৳${Number(r.unitPrice).toFixed(2)}` : "-"}</td>
                    <td>৳{Number(r.charge).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <Pagination page={page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPageChange={setPage} />
        </div>
      )}
    </Shell>
  );
}
