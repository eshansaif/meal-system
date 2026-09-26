// "use client";

// import { useEffect, useState, useCallback } from "react";
// import Shell from "@/components/Shell";
// import Badge from "@/components/Badge";
// import Pagination from "@/components/Pagination";
// import ConfirmDialog from "@/components/ConfirmDialog";
// import SearchableSelect from "@/components/SearchableSelect";
// import type { ServerSession } from "@/lib/serverSession";
// import { apiGet, apiPost } from "@/lib/apiClient";
// import { useToast } from "@/components/Toast";
// import { TableSkeleton } from "@/components/Skeleton";

// function currentMonth() {
//   const d = new Date();
//   return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
// }

// export default function PaymentsClient({ session }: { session: ServerSession }) {
//   const toast = useToast();
//   const [search, setSearch] = useState("");
//   const [month, setMonth] = useState("");
//   const [status, setStatus] = useState("");
//   const [page, setPage] = useState(1);
//   const [rows, setRows] = useState<any[]>([]);
//   const [meta, setMeta] = useState({ total: 0, totalPages: 1, pageSize: 25 });
//   const [showCreate, setShowCreate] = useState(false);
//   const [voidTarget, setVoidTarget] = useState<any>(null);
//   const [loading, setLoading] = useState(true);

//   const load = useCallback(async () => {
//     setLoading(true);
//     const params = new URLSearchParams({
//       page: String(page), pageSize: "25",
//       ...(search ? { search } : {}), ...(month ? { settlementMonth: month } : {}), ...(status ? { status } : {})
//     });
//     const res = await apiGet(`/api/payments?${params}`);
//     if (res.success) {
//       setRows(res.data.payments);
//       setMeta({ total: res.data.total, totalPages: res.data.totalPages, pageSize: res.data.pageSize });
//     }
//     setLoading(false);
//   }, [page, search, month, status]);

//   useEffect(() => { load(); }, [load]);

//   async function voidPayment(reason?: string) {
//     const res = await apiPost(`/api/payments/${voidTarget.id}/void`, { reason });
//     if (!res.success) toast(res.message, "error");
//     else toast("Payment voided");
//     setVoidTarget(null);
//     load();
//   }


//   return (
//     <Shell role={session.role} name={session.name}>
//       <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
//         <h1 className="text-xl font-semibold text-ink-900">Payments</h1>
//         <button className="btn btn-success" onClick={() => setShowCreate(true)}>+ Record Payment</button>
//       </div>

//       <div className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
//         <div className="w-full sm:w-64"><label className="label">Search (Employee / Reference)</label><input className="input" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>
//         <div><label className="label">Settlement Month</label><input type="month" className="input" value={month} onChange={(e) => { setMonth(e.target.value); setPage(1); }} /></div>
//         <div>
//           <label className="label">Status</label>
//           <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
//             <option value="">All</option>
//             <option value="ACTIVE">Active</option>
//             <option value="VOIDED">Voided</option>
//           </select>
//         </div>
//       </div>

//       {loading ? (
//         <TableSkeleton rows={8} cols={8} />
//       ) : (
//         <div className="card overflow-x-auto">
//           <table className="data-table">
//             <thead><tr><th>Date</th><th>Employee</th><th>Amount</th><th>Method</th><th>Reference</th><th>Month</th><th>Status</th><th></th></tr></thead>
//             <tbody>
//               {rows.length === 0 ? (
//                 <tr><td colSpan={8} className="text-center text-ink-400 py-8">No payments found.</td></tr>
//               ) : (
//                 rows.map((p) => (
//                   <tr key={p.id}>
//                     <td>{new Date(p.paymentDate).toDateString()}</td>
//                     <td>{p.employee.name}<div className="text-xs text-ink-400">{p.employee.employeeCode} · {p.employee.department.name}</div></td>
//                     <td>৳{Number(p.amount).toFixed(2)}</td>
//                     <td>{p.method.replaceAll("_", " ")}</td>
//                     <td>{p.referenceNo || "-"}</td>
//                     <td>{p.settlementMonth}</td>
//                     <td><Badge status={p.status} /></td>
//                     <td>{p.status === "ACTIVE" && <button className="btn btn-outline-danger text-xs" onClick={() => setVoidTarget(p)}>Void</button>}</td>
//                   </tr>
//                 ))
//               )}
//             </tbody>
//           </table>
//           <Pagination page={page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPageChange={setPage} />
//         </div>
//       )}

//       {showCreate && <CreatePaymentModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); toast("Payment recorded"); }} />}

//       <ConfirmDialog
//         open={!!voidTarget}
//         title={`Void payment of ৳${voidTarget ? Number(voidTarget.amount).toFixed(2) : ""}?`}
//         description="This reverses the payment from settlement totals. The original record is kept for audit purposes."
//         requireReason
//         confirmLabel="Void Payment"
//         danger
//         onConfirm={voidPayment}
//         onCancel={() => setVoidTarget(null)}
//       />
//     </Shell>
//   );
// }

// function CreatePaymentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
//   const [employees, setEmployees] = useState<any[]>([]);
//   const [loadingEmp, setLoadingEmp] = useState(true);
//   const [form, setForm] = useState({
//     employeeId: "", paymentDate: new Date().toISOString().slice(0, 10), amount: "", method: "CASH",
//     referenceNo: "", settlementMonth: currentMonth(), remarks: ""
//   });
//   const [error, setError] = useState("");
//   const [saving, setSaving] = useState(false);

//   useEffect(() => {
//     apiGet("/api/employees?pageSize=100").then((r) => {
//       if (r.success) setEmployees(r.data.employees);
//       setLoadingEmp(false);
//     });
//   }, []);

//   async function submit(e: React.FormEvent) {
//     e.preventDefault();
//     setSaving(true);
//     setError("");
//     const res = await apiPost("/api/payments", form);
//     setSaving(false);
//     if (!res.success) { setError(res.message); return; }
//     onCreated();
//   }

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4">
//       <form onSubmit={submit} className="card w-full max-w-lg p-5 sm:p-6 space-y-3 max-h-[90vh] overflow-y-auto">
//         <h3 className="text-lg font-semibold text-ink-900">Record Payment</h3>
//         {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
//         <div>
//           <label className="label">Employee</label>
//           <SearchableSelect
//             options={employees.map((e) => ({ value: e.id, label: e.name, sublabel: `${e.employeeCode} · ${e.department.name}` }))}
//             value={form.employeeId || null}
//             onChange={(v) => setForm({ ...form, employeeId: v || "" })}
//             placeholder="Search employee by name or ID"
//             loading={loadingEmp}
//           />
//         </div>
//         <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
//           <div><label className="label">Payment Date</label><input type="date" className="input" required value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} /></div>
//           <div><label className="label">Amount</label><input type="number" step="0.01" min="0.01" className="input" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
//           <div>
//             <label className="label">Method</label>
//             <select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
//               <option value="CASH">Cash</option>
//               <option value="BANK_TRANSFER">Bank Transfer</option>
//               <option value="MOBILE_BANKING">Mobile Banking</option>
//               <option value="OTHER">Other</option>
//             </select>
//           </div>
//           <div><label className="label">Settlement Month</label><input type="month" className="input" required value={form.settlementMonth} onChange={(e) => setForm({ ...form, settlementMonth: e.target.value })} /></div>
//           <div><label className="label">Reference No.</label><input className="input" value={form.referenceNo} onChange={(e) => setForm({ ...form, referenceNo: e.target.value })} /></div>
//         </div>
//         <div><label className="label">Remarks</label><textarea className="input" rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
//         <div className="flex justify-end gap-2 pt-2">
//           <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
//           <button type="submit" className="btn btn-primary" disabled={saving || !form.employeeId}>{saving ? "Saving…" : "Record Payment"}</button>
//         </div>
//       </form>
//     </div>
//   );
// }



"use client";

import { useEffect, useState, useCallback } from "react";
import Shell from "@/components/Shell";
import Badge from "@/components/Badge";
import Pagination from "@/components/Pagination";
import ConfirmDialog from "@/components/ConfirmDialog";
import SearchableSelect from "@/components/SearchableSelect";
import type { ServerSession } from "@/lib/serverSession";
import { apiGet, apiPost } from "@/lib/apiClient";
import { useToast } from "@/components/Toast";
import { TableSkeleton } from "@/components/Skeleton";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function PaymentsClient({ session }: { session: ServerSession }) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, pageSize: 25 });
  const [showCreate, setShowCreate] = useState(false);
  const [voidTarget, setVoidTarget] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page), pageSize: "25",
      ...(search ? { search } : {}), ...(month ? { settlementMonth: month } : {}), ...(status ? { status } : {})
    });
    const res = await apiGet(`/api/payments?${params}`);
    if (res.success) {
      setRows(res.data.payments);
      setMeta({ total: res.data.total, totalPages: res.data.totalPages, pageSize: res.data.pageSize });
    }
    setLoading(false);
  }, [page, search, month, status]);

  useEffect(() => { load(); }, [load]);

  async function voidPayment(reason?: string) {
    const res = await apiPost(`/api/payments/${voidTarget.id}/void`, { reason });
    if (!res.success) toast(res.message, "error");
    else toast("Payment voided");
    setVoidTarget(null);
    load();
  }


  return (
    <Shell role={session.role} name={session.name}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h1 className="text-xl font-semibold text-ink-900">Payments</h1>
        <button className="btn btn-success" onClick={() => setShowCreate(true)}>+ Record Payment</button>
      </div>

      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="w-full sm:w-64"><label className="label">Search (Employee / Reference)</label><input className="input" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>
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

      {loading ? (
        <TableSkeleton rows={8} cols={8} />
      ) : (
        <div className="card overflow-x-auto">
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
                    <td>{p.status === "ACTIVE" && <button className="btn btn-outline-danger text-xs" onClick={() => setVoidTarget(p)}>Void</button>}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <Pagination page={page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPageChange={setPage} />
        </div>
      )}

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

/** Formats an employee's current balance as a bracketed hint for the payment-form dropdown. */
function dueLabel(e: any): string {
  const due = Number(e.currentOutstanding ?? 0);
  const credit = Number(e.currentCredit ?? 0);
  if (due > 0) return `(Due: ৳${due.toFixed(2)})`;
  if (credit > 0) return `(Credit: ৳${credit.toFixed(2)})`;
  return "(No due)";
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
    apiGet("/api/employees?pageSize=100&includeDue=true").then((r) => {
      if (r.success) setEmployees(r.data.employees);
      setLoadingEmp(false);
    });
  }, []);

  function selectEmployee(employeeId: string | null) {
    if (!employeeId) {
      setForm({ ...form, employeeId: "" });
      return;
    }
    const emp = employees.find((e) => e.id === employeeId);
    // Auto-fill the amount with this employee's current due — they can
    // still edit it before submitting (e.g. for a partial payment).
    const due = emp?.currentOutstanding ?? 0;
    setForm({ ...form, employeeId, amount: due > 0 ? due.toFixed(2) : form.amount });
  }

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
      <form onSubmit={submit} className="card w-full max-w-lg p-5 sm:p-6 space-y-3 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-ink-900">Record Payment</h3>
        {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
        <div>
          <label className="label">Employee</label>
          <SearchableSelect
            options={employees.map((e) => ({
              value: e.id,
              label: `${e.name} ${dueLabel(e)}`,
              sublabel: `${e.employeeCode} · ${e.department.name}`
            }))}
            value={form.employeeId || null}
            onChange={selectEmployee}
            placeholder="Search employee by name or ID"
            loading={loadingEmp}
          />
          <p className="text-xs text-ink-400 mt-1">Selecting an employee auto-fills the Amount below with their current due — you can still change it.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
