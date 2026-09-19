"use client";

import { useEffect, useState, useCallback } from "react";
import Shell from "@/components/Shell";
import Badge from "@/components/Badge";
import Pagination from "@/components/Pagination";
import ConfirmDialog from "@/components/ConfirmDialog";
import SearchableSelect from "@/components/SearchableSelect";
import { useSession } from "@/lib/useSession";
import { apiGet, apiPost } from "@/lib/apiClient";
import { useToast } from "@/components/Toast";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function PaymentsPage() {
  const { session, loading } = useSession(["SUPER_ADMIN", "HR_ADMIN"]);
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, pageSize: 25 });
  const [showCreate, setShowCreate] = useState(false);
  const [voidTarget, setVoidTarget] = useState<any>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page), pageSize: "25",
      ...(search ? { search } : {}), ...(month ? { settlementMonth: month } : {}), ...(status ? { status } : {})
    });
    const res = await apiGet(`/api/payments?${params}`);
    if (res.success) {
      setRows(res.data.payments);
      setMeta({ total: res.data.total, totalPages: res.data.totalPages, pageSize: res.data.pageSize });
    }
  }, [page, search, month, status]);

  useEffect(() => { load(); }, [load]);

  async function voidPayment(reason?: string) {
    const res = await apiPost(`/api/payments/${voidTarget.id}/void`, { reason });
    if (!res.success) toast(res.message, "error");
    else toast("Payment voided");
    setVoidTarget(null);
    load();
  }

  if (loading || !session) return <div className="p-8 text-ink-400">Loading…</div>;

  return (
    <Shell role={session.role} name={session.name}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h1 className="text-xl font-semibold text-ink-900">Payments</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Record Payment</button>
      </div>

      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="w-64"><label className="label">Search (Employee / Reference)</label><input className="input" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>
        <div><label className="label">Settlement Month</label><input type="month" className="input" value={month} onChange={(e) => { setMonth(e.target.value); setPage(1); }} /></div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="VOIDED">Voided</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="data-table">
          <thead><tr><th>Date</th><th>Employee</th><th>Amount</th><th>Method</th><th>Reference</th><th>Month</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-ink-400 py-8">No payments found.</td></tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id}>
                  <td>{new Date(p.paymentDate).toDateString()}</td>
                  <td>{p.employee.name}<div className="text-xs text-ink-400">{p.employee.employeeCode} · {p.employee.department.name}</div></td>
                  <td>৳{Number(p.amount).toFixed(2)}</td>
                  <td>{p.method.replaceAll("_", " ")}</td>
                  <td>{p.referenceNo || "-"}</td>
                  <td>{p.settlementMonth}</td>
                  <td><Badge status={p.status} /></td>
                  <td>{p.status === "ACTIVE" && <button className="btn btn-ghost text-xs text-red-600" onClick={() => setVoidTarget(p)}>Void</button>}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPageChange={setPage} />
      </div>

      {showCreate && <CreatePaymentModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); toast("Payment recorded"); }} />}

      <ConfirmDialog
        open={!!voidTarget}
        title={`Void payment of ৳${voidTarget ? Number(voidTarget.amount).toFixed(2) : ""}?`}
        description="This reverses the payment from settlement totals. The original record is kept for audit purposes."
        requireReason
        confirmLabel="Void Payment"
        danger
        onConfirm={voidPayment}
        onCancel={() => setVoidTarget(null)}
      />
    </Shell>
  );
}

function CreatePaymentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingEmp, setLoadingEmp] = useState(true);
  const [form, setForm] = useState({
    employeeId: "", paymentDate: new Date().toISOString().slice(0, 10), amount: "", method: "CASH",
    referenceNo: "", settlementMonth: currentMonth(), remarks: ""
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet("/api/employees?pageSize=100").then((r) => {
      if (r.success) setEmployees(r.data.employees);
      setLoadingEmp(false);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await apiPost("/api/payments", form);
    setSaving(false);
    if (!res.success) { setError(res.message); return; }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4">
      <form onSubmit={submit} className="card w-full max-w-lg p-6 space-y-3">
        <h3 className="text-lg font-semibold text-ink-900">Record Payment</h3>
        {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
        <div>
          <label className="label">Employee</label>
          <SearchableSelect
            options={employees.map((e) => ({ value: e.id, label: e.name, sublabel: `${e.employeeCode} · ${e.department.name}` }))}
            value={form.employeeId || null}
            onChange={(v) => setForm({ ...form, employeeId: v || "" })}
            placeholder="Search employee by name or ID"
            loading={loadingEmp}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Payment Date</label><input type="date" className="input" required value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} /></div>
          <div><label className="label">Amount</label><input type="number" step="0.01" min="0.01" className="input" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          <div>
            <label className="label">Method</label>
            <select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="MOBILE_BANKING">Mobile Banking</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div><label className="label">Settlement Month</label><input type="month" className="input" required value={form.settlementMonth} onChange={(e) => setForm({ ...form, settlementMonth: e.target.value })} /></div>
          <div><label className="label">Reference No.</label><input className="input" value={form.referenceNo} onChange={(e) => setForm({ ...form, referenceNo: e.target.value })} /></div>
        </div>
        <div><label className="label">Remarks</label><textarea className="input" rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving || !form.employeeId}>{saving ? "Saving…" : "Record Payment"}</button>
        </div>
      </form>
    </div>
  );
}
