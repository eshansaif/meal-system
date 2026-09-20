"use client";

import { useEffect, useState, useCallback } from "react";
import Shell from "@/components/Shell";
import Pagination from "@/components/Pagination";
import type { ServerSession } from "@/lib/serverSession";
import { apiGet } from "@/lib/apiClient";
import { TableSkeleton } from "@/components/Skeleton";

export default function AuditClient({ session }: { session: ServerSession }) {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, pageSize: 25 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "25", ...(search ? { search } : {}), ...(action ? { action } : {}) });
    const res = await apiGet(`/api/audit?${params}`);
    if (res.success) { setRows(res.data.logs); setMeta({ total: res.data.total, totalPages: res.data.totalPages, pageSize: res.data.pageSize }); }
    setLoading(false);
  }, [page, search, action]);

  useEffect(() => { load(); }, [load]);

  return (
    <Shell role={session.role} name={session.name}>
      <h1 className="text-xl font-semibold text-ink-900 mb-4">Audit Log</h1>
      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="w-full sm:w-64"><label className="label">Search (user / entity ID)</label><input className="input" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>
        <div className="w-full sm:w-56"><label className="label">Action</label><input className="input" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} placeholder="e.g. PAYMENT_VOID" /></div>
      </div>
      {loading ? (
        <TableSkeleton rows={10} cols={5} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Reason</th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-ink-400 py-8">No matching audit entries.</td></tr>
              ) : rows.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
                  <td>{l.user?.email || "System"}</td>
                  <td className="font-mono text-xs">{l.action}</td>
                  <td>{l.entity}{l.entityId ? ` #${l.entityId.slice(0, 8)}` : ""}</td>
                  <td>{l.reason || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPageChange={setPage} />
        </div>
      )}
    </Shell>
  );
}
